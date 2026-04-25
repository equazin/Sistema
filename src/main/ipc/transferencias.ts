import { handle } from './base'
import { getSqlite } from '../db/database'
import type { TransferenciaStock, ItemTransferencia, NuevaTransferenciaRequest } from '../../shared/types'

function mapTransferencia(r: Record<string, unknown>): TransferenciaStock {
  return {
    id: r.id as number,
    sucursalOrigenId: r.sucursal_origen_id as number,
    nombreOrigen: (r.nombre_origen as string) ?? '',
    sucursalDestinoId: r.sucursal_destino_id as number,
    nombreDestino: (r.nombre_destino as string) ?? '',
    usuarioId: r.usuario_id as number,
    estado: r.estado as TransferenciaStock['estado'],
    observacion: r.observacion as string | null,
    fecha: r.fecha as string,
    fechaRecepcion: r.fecha_recepcion as string | null,
  }
}

function mapItem(r: Record<string, unknown>): ItemTransferencia {
  return {
    productoId: r.producto_id as number,
    nombreProducto: (r.nombre as string) ?? '',
    cantidad: r.cantidad as number,
  }
}

export function registerTransferenciasHandlers(): void {
  handle('transferencias:list', ({ sucursalId }) => {
    const db = getSqlite()
    const sql = `
      SELECT t.*, so.nombre AS nombre_origen, sd.nombre AS nombre_destino
      FROM transferencias_stock t
      JOIN sucursales so ON so.id = t.sucursal_origen_id
      JOIN sucursales sd ON sd.id = t.sucursal_destino_id
      ${sucursalId ? 'WHERE t.sucursal_origen_id = ? OR t.sucursal_destino_id = ?' : ''}
      ORDER BY t.fecha DESC
    `
    const rows = sucursalId
      ? (db.prepare(sql).all(sucursalId, sucursalId) as Record<string, unknown>[])
      : (db.prepare(sql).all() as Record<string, unknown>[])
    return rows.map(mapTransferencia)
  })

  handle('transferencias:get', ({ id }) => {
    const db = getSqlite()
    const t = db.prepare(`
      SELECT t.*, so.nombre AS nombre_origen, sd.nombre AS nombre_destino
      FROM transferencias_stock t
      JOIN sucursales so ON so.id = t.sucursal_origen_id
      JOIN sucursales sd ON sd.id = t.sucursal_destino_id
      WHERE t.id = ?
    `).get(id) as Record<string, unknown> | undefined
    if (!t) throw new Error('Transferencia no encontrada')

    const items = (db.prepare(`
      SELECT it.*, p.nombre FROM items_transferencia it JOIN productos p ON p.id = it.producto_id WHERE it.transferencia_id = ?
    `).all(id) as Record<string, unknown>[]).map(mapItem)

    return { ...mapTransferencia(t), items }
  })

  handle('transferencias:crear', (req: NuevaTransferenciaRequest) => {
    const db = getSqlite()
    if (req.sucursalOrigenId === req.sucursalDestinoId) throw new Error('Origen y destino no pueden ser la misma sucursal')
    if (!req.items || req.items.length === 0) throw new Error('Debe incluir al menos un producto')

    const insertTransfer = db.prepare(`
      INSERT INTO transferencias_stock (sucursal_origen_id, sucursal_destino_id, usuario_id, observacion)
      VALUES (?, ?, ?, ?)
    `)
    const insertItem = db.prepare(`
      INSERT INTO items_transferencia (transferencia_id, producto_id, cantidad) VALUES (?, ?, ?)
    `)
    const insertMov = db.prepare(`
      INSERT INTO movimientos_stock (producto_id, tipo, cantidad, cantidad_anterior, motivo, referencia_id, referencia_tipo, usuario_id, sucursal_id)
      VALUES (?, 'salida', ?, ?, ?, ?, 'transferencia', ?, ?)
    `)
    const updateStock = db.prepare('UPDATE productos SET stock_actual = stock_actual - ? WHERE id = ?')
    const getStock = db.prepare('SELECT stock_actual FROM productos WHERE id = ?')

    const doCreate = db.transaction(() => {
      const result = insertTransfer.run(req.sucursalOrigenId, req.sucursalDestinoId, req.usuarioId, req.observacion ?? null)
      const transId = result.lastInsertRowid as number

      for (const item of req.items) {
        const prod = getStock.get(item.productoId) as { stock_actual: number } | undefined
        if (!prod) throw new Error(`Producto ${item.productoId} no encontrado`)
        if (prod.stock_actual < item.cantidad) throw new Error(`Stock insuficiente para producto ${item.productoId}`)

        insertItem.run(transId, item.productoId, item.cantidad)
        insertMov.run(item.productoId, item.cantidad, prod.stock_actual, `Transferencia #${transId}`, transId, req.usuarioId, req.sucursalOrigenId)
        updateStock.run(item.cantidad, item.productoId)

        // Sync outbox
        db.prepare(`INSERT INTO sync_outbox (sucursal_id, tabla, operacion, payload) VALUES (?, 'transferencias_stock', 'INSERT', ?)`)
          .run(req.sucursalOrigenId, JSON.stringify({ transferenciaId: transId, ...item }))
      }

      return transId
    })

    const transId = doCreate()
    const t = db.prepare(`
      SELECT t.*, so.nombre AS nombre_origen, sd.nombre AS nombre_destino
      FROM transferencias_stock t
      JOIN sucursales so ON so.id = t.sucursal_origen_id
      JOIN sucursales sd ON sd.id = t.sucursal_destino_id
      WHERE t.id = ?
    `).get(transId) as Record<string, unknown>
    return mapTransferencia(t)
  })

  handle('transferencias:recibir', ({ id, usuarioId }) => {
    const db = getSqlite()
    const t = db.prepare('SELECT * FROM transferencias_stock WHERE id = ?').get(id) as Record<string, unknown> | undefined
    if (!t) throw new Error('Transferencia no encontrada')
    if (t.estado !== 'pendiente' && t.estado !== 'en_transito') throw new Error('Solo se pueden recibir transferencias pendientes o en tránsito')

    const items = db.prepare('SELECT * FROM items_transferencia WHERE transferencia_id = ?').all(id) as Record<string, unknown>[]
    const insertMov = db.prepare(`
      INSERT INTO movimientos_stock (producto_id, tipo, cantidad, cantidad_anterior, motivo, referencia_id, referencia_tipo, usuario_id, sucursal_id)
      VALUES (?, 'entrada', ?, ?, ?, ?, 'transferencia', ?, ?)
    `)
    const updateStock = db.prepare('UPDATE productos SET stock_actual = stock_actual + ? WHERE id = ?')
    const getStock = db.prepare('SELECT stock_actual FROM productos WHERE id = ?')

    db.transaction(() => {
      for (const item of items) {
        const prod = getStock.get(item.producto_id) as { stock_actual: number }
        insertMov.run(item.producto_id, item.cantidad, prod.stock_actual, `Recepción transferencia #${id}`, id, usuarioId, t.sucursal_destino_id)
        updateStock.run(item.cantidad, item.producto_id)
      }
      db.prepare(`UPDATE transferencias_stock SET estado = 'recibida', fecha_recepcion = datetime('now','localtime') WHERE id = ?`).run(id)
      db.prepare(`INSERT INTO sync_outbox (sucursal_id, tabla, operacion, payload) VALUES (?, 'transferencias_stock', 'UPDATE', ?)`)
        .run(t.sucursal_destino_id, JSON.stringify({ id, estado: 'recibida' }))
    })()
  })

  handle('transferencias:cancelar', ({ id, usuarioId: _usuarioId }) => {
    const db = getSqlite()
    const t = db.prepare('SELECT * FROM transferencias_stock WHERE id = ?').get(id) as Record<string, unknown> | undefined
    if (!t) throw new Error('Transferencia no encontrada')
    if (t.estado === 'recibida') throw new Error('No se puede cancelar una transferencia ya recibida')

    // Return stock to origin
    const items = db.prepare('SELECT * FROM items_transferencia WHERE transferencia_id = ?').all(id) as Record<string, unknown>[]
    const insertMov = db.prepare(`
      INSERT INTO movimientos_stock (producto_id, tipo, cantidad, cantidad_anterior, motivo, referencia_id, referencia_tipo, usuario_id, sucursal_id)
      VALUES (?, 'entrada', ?, ?, ?, ?, 'transferencia', ?, ?)
    `)
    const updateStock = db.prepare('UPDATE productos SET stock_actual = stock_actual + ? WHERE id = ?')
    const getStock = db.prepare('SELECT stock_actual FROM productos WHERE id = ?')

    db.transaction(() => {
      for (const item of items) {
        const prod = getStock.get(item.producto_id) as { stock_actual: number }
        insertMov.run(item.producto_id, item.cantidad, prod.stock_actual, `Cancelación transferencia #${id}`, id, _usuarioId, t.sucursal_origen_id)
        updateStock.run(item.cantidad, item.producto_id)
      }
      db.prepare(`UPDATE transferencias_stock SET estado = 'cancelada' WHERE id = ?`).run(id)
    })()
  })
}
