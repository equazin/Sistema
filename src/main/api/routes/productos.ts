import type { IncomingMessage, ServerResponse } from 'http'
import { ok, error } from '../response'
import { getSqlite } from '../../db/database'
import { parseQuery, parsePagination } from '../router'

export function handleProductos(req: IncomingMessage, res: ServerResponse, pathParts: string[]): void {
  const db = getSqlite()

  // GET /api/v1/productos/barcode/:code
  if (pathParts[3] === 'barcode' && pathParts[4]) {
    const codigo = decodeURIComponent(pathParts[4])
    const row = db.prepare(`
      SELECT p.*, c.nombre AS categoria_nombre
      FROM productos p LEFT JOIN categorias c ON c.id = p.categoria_id
      WHERE p.codigo_barras = ? AND p.activo = 1
    `).get(codigo) as Record<string, unknown> | undefined
    if (!row) return error(res, 404, 'Producto no encontrado')
    return ok(res, mapProducto(row))
  }

  // GET /api/v1/productos/:id
  if (pathParts[3] && !isNaN(Number(pathParts[3]))) {
    const id = Number(pathParts[3])
    const row = db.prepare(`
      SELECT p.*, c.nombre AS categoria_nombre
      FROM productos p LEFT JOIN categorias c ON c.id = p.categoria_id
      WHERE p.id = ? AND p.activo = 1
    `).get(id) as Record<string, unknown> | undefined
    if (!row) return error(res, 404, 'Producto no encontrado')
    return ok(res, mapProducto(row))
  }

  // GET /api/v1/productos
  const query = parseQuery(req.url ?? '')
  const { page, limit, offset } = parsePagination(query)
  const search = (query.search as string | undefined) ?? ''
  const conditions = ['p.activo = 1']
  const params: unknown[] = []
  if (search) { conditions.push('(p.nombre LIKE ? OR p.codigo_barras LIKE ?)'); params.push(`%${search}%`, `%${search}%`) }
  const where = `WHERE ${conditions.join(' AND ')}`

  const total = (db.prepare(`SELECT COUNT(*) as c FROM productos p ${where}`).get(...params) as { c: number }).c
  const rows = db.prepare(`
    SELECT p.*, c.nombre AS categoria_nombre
    FROM productos p LEFT JOIN categorias c ON c.id = p.categoria_id
    ${where} ORDER BY p.nombre LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as Record<string, unknown>[]

  ok(res, rows.map(mapProducto), { total, page, limit })
}

function mapProducto(r: Record<string, unknown>) {
  return {
    id: r.id,
    nombre: r.nombre,
    codigoBarras: r.codigo_barras,
    codigoInterno: r.codigo_interno,
    precioCosto: r.precio_costo,
    precioVenta: r.precio_venta,
    precioMayorista: r.precio_mayorista,
    stockActual: r.stock_actual,
    stockMinimo: r.stock_minimo,
    unidadMedida: r.unidad_medida,
    pesable: Boolean(r.pesable),
    categoria: r.categoria_nombre ?? null,
    updatedAt: r.updated_at,
  }
}
