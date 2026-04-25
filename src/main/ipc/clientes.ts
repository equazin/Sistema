import { handle } from './base'
import { getSqlite } from '../db/database'
import type { Cliente } from '../../shared/types'
import { registrarAuditoria } from './auditoria'

export function registerClientesHandlers(): void {
  handle('clientes:list', ({ search }) => {
    const db = getSqlite()
    if (search?.trim()) {
      const q = `%${search}%`
      const rows = db.prepare(`
        SELECT * FROM clientes
        WHERE activo = 1 AND (nombre LIKE ? OR cuit_dni LIKE ? OR telefono LIKE ?)
        ORDER BY nombre LIMIT 50
      `).all(q, q, q) as Record<string, unknown>[]
      return rows.map(mapCliente)
    }
    const rows = db.prepare('SELECT * FROM clientes WHERE activo = 1 ORDER BY nombre LIMIT 100').all() as Record<string, unknown>[]
    return rows.map(mapCliente)
  })

  handle('clientes:get', ({ id }) => {
    const db = getSqlite()
    const row = db.prepare('SELECT * FROM clientes WHERE id = ?').get(id) as Record<string, unknown> | undefined
    if (!row) throw new Error('Cliente no encontrado')
    return mapCliente(row)
  })

  handle('clientes:create', (data) => {
    const db = getSqlite()
    const result = db.prepare(`
      INSERT INTO clientes (negocio_id, nombre, cuit_dni, telefono, email, condicion_afip, limite_credito)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.negocioId,
      data.nombre,
      data.cuitDni ?? null,
      data.telefono ?? null,
      data.email ?? null,
      data.condicionAfip ?? 'consumidor_final',
      data.limiteCredito ?? 0
    )
    registrarAuditoria(db, {
      usuarioId: data.usuarioId,
      accion: 'cliente_creado',
      tabla: 'clientes',
      referenciaId: result.lastInsertRowid as number,
      detalle: { nombre: data.nombre, limiteCredito: data.limiteCredito ?? 0 },
    })
    const row = db.prepare('SELECT * FROM clientes WHERE id = ?').get(result.lastInsertRowid)
    return mapCliente(row as Record<string, unknown>)
  })

  handle('clientes:update', ({ id, usuarioId, ...data }) => {
    const db = getSqlite()
    db.prepare(`
      UPDATE clientes
      SET nombre = ?, cuit_dni = ?, telefono = ?, email = ?, condicion_afip = ?, limite_credito = ?
      WHERE id = ?
    `).run(
      data.nombre,
      data.cuitDni ?? null,
      data.telefono ?? null,
      data.email ?? null,
      data.condicionAfip ?? 'consumidor_final',
      data.limiteCredito ?? 0,
      id
    )
    registrarAuditoria(db, {
      usuarioId,
      accion: 'cliente_actualizado',
      tabla: 'clientes',
      referenciaId: id,
      detalle: { nombre: data.nombre, limiteCredito: data.limiteCredito ?? 0 },
    })
    const row = db.prepare('SELECT * FROM clientes WHERE id = ?').get(id)
    return mapCliente(row as Record<string, unknown>)
  })

  handle('clientes:delete', ({ id, usuarioId }) => {
    const db = getSqlite()
    db.prepare('UPDATE clientes SET activo = 0 WHERE id = ?').run(id)
    registrarAuditoria(db, {
      usuarioId,
      accion: 'cliente_desactivado',
      tabla: 'clientes',
      referenciaId: id,
    })
  })

  handle('clientes:estadoCuenta', ({ clienteId }) => {
    const db = getSqlite()
    const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(clienteId) as Record<string, unknown> | undefined
    if (!cliente) throw new Error('Cliente no encontrado')

    const ventas = db.prepare(`
      SELECT v.id, v.fecha, v.total, v.estado
      FROM ventas v
      JOIN pagos_venta pv ON pv.venta_id = v.id
      WHERE v.cliente_id = ? AND pv.medio_pago = 'cuenta_corriente' AND v.estado = 'completada'
      ORDER BY v.fecha DESC
    `).all(clienteId) as Record<string, unknown>[]

    const cobranzas = db.prepare(`
      SELECT * FROM cobranzas WHERE cliente_id = ? ORDER BY fecha DESC
    `).all(clienteId) as Record<string, unknown>[]

    return {
      cliente: mapCliente(cliente),
      ventas: ventas.map(v => ({
        id: v.id as number,
        fecha: v.fecha as string,
        total: v.total as number,
        estado: v.estado as string,
      })),
      cobranzas: cobranzas.map(c => ({
        id: c.id as number,
        fecha: c.fecha as string,
        monto: c.monto as number,
        medioPago: c.medio_pago as string,
        observacion: c.observacion as string | null,
      })),
      saldoActual: cliente.saldo_cuenta_corriente as number,
    }
  })

  handle('clientes:registrarCobranza', ({ clienteId, monto, medioPago, observacion, usuarioId }) => {
    const db = getSqlite()
    const registrar = db.transaction(() => {
      db.prepare(`
        INSERT INTO cobranzas (cliente_id, usuario_id, monto, medio_pago, observacion)
        VALUES (?, ?, ?, ?, ?)
      `).run(clienteId, usuarioId, monto, medioPago, observacion ?? null)

      db.prepare(`
        UPDATE clientes
        SET saldo_cuenta_corriente = saldo_cuenta_corriente - ?
        WHERE id = ?
      `).run(monto, clienteId)
    })
    registrar()
    registrarAuditoria(db, {
      usuarioId,
      accion: 'cobranza_registrada',
      tabla: 'clientes',
      referenciaId: clienteId,
      detalle: { monto, medioPago, observacion: observacion ?? null },
    })
  })
}

function mapCliente(row: Record<string, unknown>): Cliente {
  return {
    id: row.id as number,
    negocioId: row.negocio_id as number,
    nombre: row.nombre as string,
    cuitDni: row.cuit_dni as string | null,
    telefono: row.telefono as string | null,
    email: row.email as string | null,
    condicionAfip: row.condicion_afip as Cliente['condicionAfip'],
    limiteCredito: row.limite_credito as number,
    saldoCuentaCorriente: row.saldo_cuenta_corriente as number,
    activo: Boolean(row.activo),
  }
}
