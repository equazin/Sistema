import { handle } from './base'
import { getSqlite } from '../db/database'
import type { MovimientoStock } from '../../shared/types'
import { assertPermisoUsuario } from './permisos'
import { registrarAuditoria } from './auditoria'

export function registerStockHandlers(): void {
  handle('stock:movimientos', ({ productoId, limit = 100 }) => {
    const db = getSqlite()
    const where = productoId ? 'WHERE producto_id = ?' : ''
    const params = productoId ? [productoId, limit] : [limit]
    const rows = db.prepare(
      `SELECT * FROM movimientos_stock ${where} ORDER BY fecha DESC LIMIT ?`
    ).all(...params) as Record<string, unknown>[]
    return rows.map(mapMovimiento)
  })

  handle('stock:ajustar', ({ productoId, cantidad, motivo, usuarioId }) => {
    const db = getSqlite()
    assertPermisoUsuario(db, usuarioId, 'stock:ajustar')
    const producto = db.prepare('SELECT stock_actual FROM productos WHERE id = ?').get(productoId) as { stock_actual: number } | undefined
    if (!producto) throw new Error(`Producto ${productoId} no encontrado`)

    const cantidadAnterior = producto.stock_actual
    const diferencia = cantidad - cantidadAnterior

    db.transaction(() => {
      db.prepare(`
        INSERT INTO movimientos_stock (producto_id, tipo, cantidad, cantidad_anterior, motivo, usuario_id)
        VALUES (?, 'ajuste', ?, ?, ?, ?)
      `).run(productoId, Math.abs(diferencia), cantidadAnterior, motivo, usuarioId)

      db.prepare("UPDATE productos SET stock_actual = ?, updated_at = datetime('now','localtime') WHERE id = ?").run(cantidad, productoId)

      registrarAuditoria(db, {
        usuarioId,
        accion: 'ajuste_stock',
        tabla: 'productos',
        referenciaId: productoId,
        detalle: { cantidadAnterior, cantidadNueva: cantidad, motivo },
      })
    })()
  })
}

function mapMovimiento(row: Record<string, unknown>): MovimientoStock {
  return {
    id: row.id as number,
    productoId: row.producto_id as number,
    tipo: row.tipo as MovimientoStock['tipo'],
    cantidad: row.cantidad as number,
    cantidadAnterior: row.cantidad_anterior as number,
    motivo: row.motivo as string | null,
    referenciaId: row.referencia_id as number | null,
    referenciaTipo: row.referencia_tipo as string | null,
    usuarioId: row.usuario_id as number | null,
    fecha: row.fecha as string,
  }
}
