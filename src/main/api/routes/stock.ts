import type { IncomingMessage, ServerResponse } from 'http'
import { ok } from '../response'
import { getSqlite } from '../../db/database'
import { parseQuery, parsePagination } from '../router'

export function handleStock(req: IncomingMessage, res: ServerResponse, pathParts: string[]): void {
  const db = getSqlite()

  if (pathParts[3] === 'movimientos') {
    const query = parseQuery(req.url ?? '')
    const { limit, offset } = parsePagination(query)
    const productoId = query.producto_id ? Number(query.producto_id) : null
    const cond = productoId ? 'WHERE ms.producto_id = ?' : ''
    const params: unknown[] = productoId ? [productoId] : []
    const rows = db.prepare(`
      SELECT ms.*, p.nombre AS nombre_producto
      FROM movimientos_stock ms JOIN productos p ON p.id = ms.producto_id
      ${cond} ORDER BY ms.fecha DESC LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as Record<string, unknown>[]
    return ok(res, rows.map(r => ({
      id: r.id,
      productoId: r.producto_id,
      nombreProducto: r.nombre_producto,
      tipo: r.tipo,
      cantidad: r.cantidad,
      cantidadAnterior: r.cantidad_anterior,
      motivo: r.motivo,
      fecha: r.fecha,
    })))
  }

  // GET /api/v1/stock — productos con stock bajo mínimo highlighted
  const query = parseQuery(req.url ?? '')
  const { page, limit, offset } = parsePagination(query)
  const soloAlerta = query.alerta === '1'
  const cond = soloAlerta ? 'WHERE p.activo = 1 AND p.stock_actual < p.stock_minimo' : 'WHERE p.activo = 1'
  const total = (db.prepare(`SELECT COUNT(*) as c FROM productos p ${cond}`).get() as { c: number }).c
  const rows = db.prepare(`
    SELECT p.id, p.nombre, p.codigo_barras, p.stock_actual, p.stock_minimo, p.unidad_medida,
           c.nombre AS categoria
    FROM productos p LEFT JOIN categorias c ON c.id = p.categoria_id
    ${cond} ORDER BY p.nombre LIMIT ? OFFSET ?
  `).all(limit, offset) as Record<string, unknown>[]

  ok(res, rows.map(r => ({
    id: r.id,
    nombre: r.nombre,
    codigoBarras: r.codigo_barras,
    stockActual: r.stock_actual,
    stockMinimo: r.stock_minimo,
    unidadMedida: r.unidad_medida,
    categoria: r.categoria,
    bajoMinimo: Number(r.stock_actual) < Number(r.stock_minimo),
  })), { total, page, limit })
}
