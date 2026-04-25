import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type InvokeHandler = (_event: unknown, request: unknown) => Promise<unknown>

const handlers = new Map<string, InvokeHandler>()
let userDataPath = ''
let sqlite: import('better-sqlite3').Database | null = null
let consoleErrorSpy: { mockRestore: () => void } | null = null

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name !== 'userData') throw new Error(`Unexpected app path: ${name}`)
      return userDataPath
    }),
  },
  ipcMain: {
    handle: vi.fn((channel: string, handler: InvokeHandler) => {
      handlers.set(channel, handler)
    }),
  },
}))

describe('ventas:crear cuenta corriente con SQLite', () => {
  beforeEach(() => {
    handlers.clear()
    sqlite = null
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    userDataPath = mkdtempSync(join(tmpdir(), 'sistema-pos-'))
    vi.resetModules()
  })

  afterEach(() => {
    consoleErrorSpy?.mockRestore()
    try {
      sqlite?.close()
    } catch {
      // Ignore cleanup errors from already closed databases.
    }
    rmSync(userDataPath, { recursive: true, force: true })
  })

  it('asocia la venta al cliente y actualiza el saldo cuando cobra por cuenta corriente', async () => {
    const { db, handler } = await setupVentasHandler()
    const ids = seedSaleData(db, { limiteCredito: 1000, saldoInicial: 100 })

    const result = await handler(null, buildVentaRequest(ids, 250)) as {
      success: boolean
      data?: { id: number; clienteId: number | null; total: number }
      error?: string
    }

    expect(result.success).toBe(true)
    expect(result.data?.clienteId).toBe(ids.clienteId)
    expect(result.data?.total).toBe(250)

    const cliente = db
      .prepare('SELECT saldo_cuenta_corriente FROM clientes WHERE id = ?')
      .get(ids.clienteId) as { saldo_cuenta_corriente: number }
    expect(cliente.saldo_cuenta_corriente).toBe(350)
  })

  it('rechaza la venta si supera el limite de credito y no cambia el saldo', async () => {
    const { db, handler } = await setupVentasHandler()
    const ids = seedSaleData(db, { limiteCredito: 300, saldoInicial: 100 })

    const result = await handler(null, buildVentaRequest(ids, 250)) as {
      success: boolean
      error?: string
    }

    expect(result.success).toBe(false)
    expect(result.error).toContain('límite de crédito')

    const cliente = db
      .prepare('SELECT saldo_cuenta_corriente FROM clientes WHERE id = ?')
      .get(ids.clienteId) as { saldo_cuenta_corriente: number }
    expect(cliente.saldo_cuenta_corriente).toBe(100)
  })

  it('rechaza cuenta corriente sin cliente', async () => {
    const { db, handler } = await setupVentasHandler()
    const ids = seedSaleData(db, { limiteCredito: 1000, saldoInicial: 0 })

    const result = await handler(null, {
      ...buildVentaRequest(ids, 250),
      clienteId: null,
    }) as { success: boolean; error?: string }

    expect(result.success).toBe(false)
    expect(result.error).toContain('Seleccioná un cliente')
  })
})

async function setupVentasHandler(): Promise<{
  db: import('better-sqlite3').Database
  handler: InvokeHandler
}> {
  const { initDatabase, getSqlite } = await import('../src/main/db/database')
  const { registerVentasHandlers } = await import('../src/main/ipc/ventas')

  initDatabase()
  sqlite = getSqlite()
  registerVentasHandlers()

  const handler = handlers.get('ventas:crear')
  if (!handler) throw new Error('ventas:crear handler was not registered')

  return { db: sqlite, handler }
}

function seedSaleData(
  db: import('better-sqlite3').Database,
  opts: { limiteCredito: number; saldoInicial: number }
): { turnoId: number; clienteId: number; productoId: number; usuarioId: number } {
  const negocio = db.prepare('SELECT id FROM negocios LIMIT 1').get() as { id: number }
  const caja = db.prepare('SELECT id FROM cajas LIMIT 1').get() as { id: number }
  const usuario = db.prepare('SELECT id FROM usuarios LIMIT 1').get() as { id: number }

  const clienteResult = db.prepare(`
    INSERT INTO clientes (
      negocio_id, nombre, cuit_dni, condicion_afip,
      saldo_cuenta_corriente, limite_credito, activo
    )
    VALUES (?, 'Cliente Cuenta', '20123456789', 'consumidor_final', ?, ?, 1)
  `).run(negocio.id, opts.saldoInicial, opts.limiteCredito)

  const productoResult = db.prepare(`
    INSERT INTO productos (
      negocio_id, nombre, precio_costo, precio_venta, stock_actual, stock_minimo
    )
    VALUES (?, 'Producto test', 100, 250, 10, 0)
  `).run(negocio.id)

  const turnoResult = db.prepare(`
    INSERT INTO turnos_caja (caja_id, usuario_id, monto_apertura)
    VALUES (?, ?, 0)
  `).run(caja.id, usuario.id)

  return {
    turnoId: Number(turnoResult.lastInsertRowid),
    clienteId: Number(clienteResult.lastInsertRowid),
    productoId: Number(productoResult.lastInsertRowid),
    usuarioId: usuario.id,
  }
}

function buildVentaRequest(
  ids: { turnoId: number; clienteId: number; productoId: number; usuarioId: number },
  total: number
): unknown {
  return {
    turnoId: ids.turnoId,
    sucursalId: 1,
    usuarioId: ids.usuarioId,
    clienteId: ids.clienteId,
    items: [
      {
        productoId: ids.productoId,
        cantidad: 1,
        precioUnitario: total,
        descuento: 0,
        subtotal: total,
        pesable: false,
      },
    ],
    pagos: [{ medioPago: 'cuenta_corriente', monto: total, referencia: null }],
    descuentoTotal: 0,
    tipoComprobante: 'ticket',
  }
}
