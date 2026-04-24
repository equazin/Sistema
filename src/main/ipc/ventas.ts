import { handle } from './base'
import { getSqlite } from '../db/database'
import type { Venta, VentaDetalle } from '../../shared/types'

export function registerVentasHandlers(): void {
  handle('ventas:crear', (data) => {
    const db = getSqlite()

    const createVenta = db.transaction(() => {
      const subtotal = data.items.reduce((sum, i) => sum + i.subtotal, 0)
      const total = subtotal - data.descuentoTotal

      const ventaResult = db.prepare(`
        INSERT INTO ventas (turno_id, sucursal_id, usuario_id, cliente_id, subtotal, descuento_total, total, tipo_comprobante)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        data.turnoId,
        data.sucursalId,
        data.usuarioId,
        data.clienteId ?? null,
        subtotal,
        data.descuentoTotal,
        total,
        data.tipoComprobante
      )
      const ventaId = ventaResult.lastInsertRowid as number

      const itemStmt = db.prepare(`
        INSERT INTO items_venta (venta_id, producto_id, cantidad, precio_unitario, descuento, subtotal, pesable)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      const stockStmt = db.prepare(`
        UPDATE productos SET stock_actual = stock_actual - ?, updated_at = datetime('now','localtime')
        WHERE id = ?
      `)
      const movStmt = db.prepare(`
        INSERT INTO movimientos_stock (producto_id, tipo, cantidad, cantidad_anterior, motivo, referencia_id, referencia_tipo, usuario_id)
        SELECT ?, 'salida', ?, stock_actual + ?, 'venta', ?, 'venta', ?
        FROM productos WHERE id = ?
      `)

      for (const item of data.items) {
        itemStmt.run(ventaId, item.productoId, item.cantidad, item.precioUnitario, item.descuento, item.subtotal, item.pesable ? 1 : 0)
        movStmt.run(item.productoId, item.cantidad, item.cantidad, ventaId, data.usuarioId, item.productoId)
        stockStmt.run(item.cantidad, item.productoId)
      }

      const pagoStmt = db.prepare(`
        INSERT INTO pagos_venta (venta_id, medio_pago, monto, referencia)
        VALUES (?, ?, ?, ?)
      `)
      for (const pago of data.pagos) {
        pagoStmt.run(ventaId, pago.medioPago, pago.monto, pago.referencia ?? null)
      }

      return ventaId
    })

    const ventaId = createVenta()
    const row = db.prepare('SELECT * FROM ventas WHERE id = ?').get(ventaId)
    return mapVenta(row as Record<string, unknown>)
  })

  handle('ventas:list', ({ turnoId, fecha }) => {
    const db = getSqlite()
    const conditions: string[] = []
    const params: unknown[] = []
    if (turnoId) { conditions.push('turno_id = ?'); params.push(turnoId) }
    if (fecha) { conditions.push("date(fecha) = date(?)"); params.push(fecha) }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const rows = db.prepare(`SELECT * FROM ventas ${where} ORDER BY fecha DESC`).all(...params)
    return rows.map(r => mapVenta(r as Record<string, unknown>))
  })

  handle('ventas:get', ({ id }) => {
    const db = getSqlite()
    const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(id) as Record<string, unknown> | undefined
    if (!venta) throw new Error(`Venta ${id} no encontrada`)

    const items = db.prepare(`
      SELECT iv.*, p.nombre as nombre_producto
      FROM items_venta iv JOIN productos p ON p.id = iv.producto_id
      WHERE iv.venta_id = ?
    `).all(id) as Record<string, unknown>[]

    const pagos = db.prepare('SELECT * FROM pagos_venta WHERE venta_id = ?').all(id) as Record<string, unknown>[]

    return {
      ...mapVenta(venta),
      items: items.map(i => ({
        productoId: i.producto_id as number,
        cantidad: i.cantidad as number,
        precioUnitario: i.precio_unitario as number,
        descuento: i.descuento as number,
        subtotal: i.subtotal as number,
        pesable: Boolean(i.pesable),
        nombreProducto: i.nombre_producto as string,
      })),
      pagos: pagos.map(p => ({
        medioPago: p.medio_pago as import('../../shared/types').MedioPago,
        monto: p.monto as number,
        referencia: p.referencia as string | null,
      })),
    } as VentaDetalle
  })
}

function mapVenta(row: Record<string, unknown>): Venta {
  return {
    id: row.id as number,
    turnoId: row.turno_id as number,
    sucursalId: row.sucursal_id as number,
    usuarioId: row.usuario_id as number,
    clienteId: row.cliente_id as number | null,
    fecha: row.fecha as string,
    subtotal: row.subtotal as number,
    descuentoTotal: row.descuento_total as number,
    total: row.total as number,
    estado: row.estado as Venta['estado'],
    tipoComprobante: row.tipo_comprobante as Venta['tipoComprobante'],
    cae: row.cae as string | null,
    caeVencimiento: row.cae_vencimiento as string | null,
    numeroComprobante: row.numero_comprobante as string | null,
  }
}
