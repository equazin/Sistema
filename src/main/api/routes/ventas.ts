import type { IncomingMessage, ServerResponse } from 'http'
import { ok, error } from '../response'
import { getSqlite } from '../../db/database'
import { parseQuery, parsePagination, readBody } from '../router'

export async function handleVentas(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const db = getSqlite()

  if (req.method === 'GET') {
    const query = parseQuery(req.url ?? '')
    const { page, limit, offset } = parsePagination(query)
    const fecha = (query.fecha as string | undefined) ?? ''
    const turnoId = query.turno_id ? Number(query.turno_id) : null

    const conditions = ["v.estado = 'completada'"]
    const params: unknown[] = []
    if (fecha) { conditions.push('date(v.fecha) = date(?)'); params.push(fecha) }
    if (turnoId) { conditions.push('v.turno_id = ?'); params.push(turnoId) }
    const where = `WHERE ${conditions.join(' AND ')}`

    const total = (db.prepare(`SELECT COUNT(*) as c FROM ventas v ${where}`).get(...params) as { c: number }).c
    const rows = db.prepare(`
      SELECT v.*, u.nombre AS nombre_usuario
      FROM ventas v LEFT JOIN usuarios u ON u.id = v.usuario_id
      ${where} ORDER BY v.fecha DESC LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as Record<string, unknown>[]

    ok(res, rows.map(mapVenta), { total, page, limit })
    return
  }

  if (req.method === 'POST') {
    // Basic create venta via API (simplified — no promotion calculation)
    let body: unknown
    try { body = await readBody(req) } catch { return error(res, 400, 'Body inválido') }
    if (typeof body !== 'object' || body === null) return error(res, 400, 'Body requerido')
    const b = body as Record<string, unknown>
    if (!b.turnoId || !b.items || !b.pagos) return error(res, 400, 'Faltan campos: turnoId, items, pagos')

    // Delegate to ventas IPC logic via DB directly
    const { registerVentasHandlers } = await import('../../ipc/ventas')
    void registerVentasHandlers // already registered; use getSqlite directly
    error(res, 501, 'POST ventas via API no implementado en esta versión — usar el POS')
    return
  }

  error(res, 405, 'Método no permitido')
}

function mapVenta(r: Record<string, unknown>) {
  return {
    id: r.id,
    turnoId: r.turno_id,
    sucursalId: r.sucursal_id,
    usuarioId: r.usuario_id,
    nombreUsuario: r.nombre_usuario,
    clienteId: r.cliente_id,
    fecha: r.fecha,
    subtotal: r.subtotal,
    descuentoTotal: r.descuento_total,
    total: r.total,
    estado: r.estado,
    tipoComprobante: r.tipo_comprobante,
  }
}
