import { mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Handler = (_event: unknown, req: unknown) => Promise<unknown>

const handlers = new Map<string, Handler>()
let userDataPath = ''
let sqlite: import('better-sqlite3').Database | null = null

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name !== 'userData') throw new Error(`Unexpected app.getPath: ${name}`)
      return userDataPath
    }),
    isPackaged: false,
  },
  ipcMain: {
    handle: vi.fn((ch: string, fn: Handler) => { handlers.set(ch, fn) }),
  },
  dialog: {
    showOpenDialog: vi.fn(),
  },
}))

function callHandler(channel: string, req: unknown): Promise<unknown> {
  const h = handlers.get(channel)
  if (!h) throw new Error(`Handler '${channel}' not registered`)
  return h(null, req)
}

async function setup(): Promise<import('better-sqlite3').Database> {
  const { initDatabase, getSqlite } = await import('../src/main/db/database')
  initDatabase()
  sqlite = getSqlite()
  return sqlite
}

// ─── CAJA ─────────────────────────────────────────────────────────────────────

describe('turno:abrir / turno:cerrar', () => {
  beforeEach(() => {
    handlers.clear()
    sqlite = null
    userDataPath = mkdtempSync(join(tmpdir(), 'pos-caja-'))
    vi.resetModules()
  })
  afterEach(() => {
    try { sqlite?.close() } catch { /* ok */ }
    rmSync(userDataPath, { recursive: true, force: true })
  })

  it('abre un turno y lo persiste en la DB', async () => {
    const db = await setup()
    const { registerCajaHandlers } = await import('../src/main/ipc/caja')
    registerCajaHandlers()

    const usuario = db.prepare('SELECT id FROM usuarios LIMIT 1').get() as { id: number }
    const caja = db.prepare('SELECT id FROM cajas LIMIT 1').get() as { id: number }

    const result = await callHandler('turno:abrir', { cajaId: caja.id, usuarioId: usuario.id, montoApertura: 500 }) as { success: boolean; data: { estado: string; montoApertura: number } }
    expect(result.success).toBe(true)
    expect(result.data.estado).toBe('abierto')
    expect(result.data.montoApertura).toBe(500)
  })

  it('no permite abrir dos turnos simultáneos', async () => {
    const db = await setup()
    const { registerCajaHandlers } = await import('../src/main/ipc/caja')
    registerCajaHandlers()

    const usuario = db.prepare('SELECT id FROM usuarios LIMIT 1').get() as { id: number }
    const caja = db.prepare('SELECT id FROM cajas LIMIT 1').get() as { id: number }

    await callHandler('turno:abrir', { cajaId: caja.id, usuarioId: usuario.id, montoApertura: 0 })
    const second = await callHandler('turno:abrir', { cajaId: caja.id, usuarioId: usuario.id, montoApertura: 0 }) as { success: boolean; error: string }
    expect(second.success).toBe(false)
    expect(second.error).toContain('turno abierto')
  })

  it('cierra el turno y calcula diferencia', async () => {
    const db = await setup()
    const { registerCajaHandlers } = await import('../src/main/ipc/caja')
    registerCajaHandlers()

    const usuario = db.prepare('SELECT id FROM usuarios LIMIT 1').get() as { id: number }
    const caja = db.prepare('SELECT id FROM cajas LIMIT 1').get() as { id: number }

    const abierto = await callHandler('turno:abrir', { cajaId: caja.id, usuarioId: usuario.id, montoApertura: 200 }) as { data: { id: number } }
    const turnoId = abierto.data.id

    const cerrado = await callHandler('turno:cerrar', { turnoId, montoCierreDeclado: 250, usuarioId: usuario.id }) as { success: boolean; data: { estado: string; diferencia: number } }
    expect(cerrado.success).toBe(true)
    expect(cerrado.data.estado).toBe('cerrado')
    expect(cerrado.data.diferencia).toBe(250)
  })
})

// ─── STOCK ────────────────────────────────────────────────────────────────────

describe('stock:ajustar', () => {
  beforeEach(() => {
    handlers.clear()
    sqlite = null
    userDataPath = mkdtempSync(join(tmpdir(), 'pos-stock-'))
    vi.resetModules()
  })
  afterEach(() => {
    try { sqlite?.close() } catch { /* ok */ }
    rmSync(userDataPath, { recursive: true, force: true })
  })

  it('ajusta el stock del producto y registra el movimiento', async () => {
    const db = await setup()
    const { registerStockHandlers } = await import('../src/main/ipc/stock')
    registerStockHandlers()

    const negocio = db.prepare('SELECT id FROM negocios LIMIT 1').get() as { id: number }
    const usuario = db.prepare('SELECT id FROM usuarios LIMIT 1').get() as { id: number }
    const r = db.prepare(`INSERT INTO productos (negocio_id, nombre, precio_costo, precio_venta, stock_actual, stock_minimo) VALUES (?, 'P test', 10, 20, 5, 0)`).run(negocio.id)
    const productoId = Number(r.lastInsertRowid)

    const result = await callHandler('stock:ajustar', { productoId, cantidad: 10, motivo: 'reposicion', usuarioId: usuario.id }) as { success: boolean }
    expect(result.success).toBe(true)

    const prod = db.prepare('SELECT stock_actual FROM productos WHERE id = ?').get(productoId) as { stock_actual: number }
    expect(prod.stock_actual).toBe(15)

    const mov = db.prepare("SELECT * FROM movimientos_stock WHERE producto_id = ? AND tipo = 'ajuste'").get(productoId) as { cantidad: number; cantidad_anterior: number } | undefined
    expect(mov).toBeDefined()
    expect(mov?.cantidad).toBe(10)
    expect(mov?.cantidad_anterior).toBe(5)
  })

  it('ajuste negativo reduce el stock', async () => {
    const db = await setup()
    const { registerStockHandlers } = await import('../src/main/ipc/stock')
    registerStockHandlers()

    const negocio = db.prepare('SELECT id FROM negocios LIMIT 1').get() as { id: number }
    const usuario = db.prepare('SELECT id FROM usuarios LIMIT 1').get() as { id: number }
    const r = db.prepare(`INSERT INTO productos (negocio_id, nombre, precio_costo, precio_venta, stock_actual, stock_minimo) VALUES (?, 'P neg', 10, 20, 20, 0)`).run(negocio.id)
    const productoId = Number(r.lastInsertRowid)

    await callHandler('stock:ajustar', { productoId, cantidad: -5, motivo: 'merma', usuarioId: usuario.id })
    const prod = db.prepare('SELECT stock_actual FROM productos WHERE id = ?').get(productoId) as { stock_actual: number }
    expect(prod.stock_actual).toBe(15)
  })
})

// ─── BACKUP ───────────────────────────────────────────────────────────────────

describe('backup:ejecutar', () => {
  beforeEach(() => {
    handlers.clear()
    sqlite = null
    userDataPath = mkdtempSync(join(tmpdir(), 'pos-backup-'))
    vi.resetModules()
  })
  afterEach(() => {
    try { sqlite?.close() } catch { /* ok */ }
    rmSync(userDataPath, { recursive: true, force: true })
  })

  it('crea un archivo de backup timestampeado', async () => {
    await setup()
    const { registerBackupHandlers } = await import('../src/main/ipc/backup')
    registerBackupHandlers()

    const destino = join(userDataPath, 'mis-backups')
    const result = await callHandler('backup:ejecutar', { destino }) as { success: boolean; data: { path: string; fecha: string } }
    expect(result.success).toBe(true)
    expect(existsSync(result.data.path)).toBe(true)
    expect(result.data.path).toContain('backup-')
  })

  it('lista los backups existentes', async () => {
    await setup()
    const { registerBackupHandlers } = await import('../src/main/ipc/backup')
    registerBackupHandlers()

    const destino = join(userDataPath, 'backups-lista')
    await callHandler('backup:ejecutar', { destino })
    await callHandler('backup:ejecutar', { destino })

    const lista = await callHandler('backup:listar', {}) as { success: boolean; data: { nombre: string }[] }
    expect(lista.success).toBe(true)
  })
})

// ─── PRECIOS MASIVOS ──────────────────────────────────────────────────────────

describe('precios:preview y precios:aplicar', () => {
  beforeEach(() => {
    handlers.clear()
    sqlite = null
    userDataPath = mkdtempSync(join(tmpdir(), 'pos-precios-'))
    vi.resetModules()
  })
  afterEach(() => {
    try { sqlite?.close() } catch { /* ok */ }
    rmSync(userDataPath, { recursive: true, force: true })
  })

  it('preview calcula el precio nuevo con porcentaje', async () => {
    const db = await setup()
    const { registerPreciosHandlers } = await import('../src/main/ipc/precios')
    registerPreciosHandlers()

    const negocio = db.prepare('SELECT id FROM negocios LIMIT 1').get() as { id: number }
    db.prepare(`INSERT INTO productos (negocio_id, nombre, precio_costo, precio_venta, stock_actual, stock_minimo) VALUES (?, 'Prod preview', 10, 100, 1, 0)`).run(negocio.id)

    const result = await callHandler('precios:preview', { tipo: 'porcentaje', porcentaje: 10, soloActivos: true }) as { success: boolean; data: { productoId: number; precioActual: number; precioNuevo: number }[] }
    expect(result.success).toBe(true)
    expect(result.data.length).toBeGreaterThan(0)
    const item = result.data.find(p => p.precioActual === 100)
    expect(item?.precioNuevo).toBe(110)
  })

  it('aplicar actualiza los precios en la base', async () => {
    const db = await setup()
    const { registerPreciosHandlers } = await import('../src/main/ipc/precios')
    registerPreciosHandlers()

    const negocio = db.prepare('SELECT id FROM negocios LIMIT 1').get() as { id: number }
    const usuario = db.prepare('SELECT id FROM usuarios LIMIT 1').get() as { id: number }
    const r = db.prepare(`INSERT INTO productos (negocio_id, nombre, precio_costo, precio_venta, stock_actual, stock_minimo) VALUES (?, 'Prod aplicar', 10, 200, 1, 0)`).run(negocio.id)
    const productoId = Number(r.lastInsertRowid)

    const result = await callHandler('precios:aplicar', { tipo: 'porcentaje', porcentaje: 50, soloActivos: true, usuarioId: usuario.id }) as { success: boolean; data: { actualizados: number } }
    expect(result.success).toBe(true)
    expect(result.data.actualizados).toBeGreaterThan(0)

    const prod = db.prepare('SELECT precio_venta FROM productos WHERE id = ?').get(productoId) as { precio_venta: number }
    expect(prod.precio_venta).toBe(300)
  })
})
