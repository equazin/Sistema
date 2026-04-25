import type { IncomingMessage, ServerResponse } from 'http'
import { ok, error } from '../response'
import { getSqlite } from '../../db/database'
import { parseQuery } from '../router'

export function handleCaja(_req: IncomingMessage, res: ServerResponse, pathParts: string[]): void {
  const db = getSqlite()

  if (pathParts[3] === 'estado') {
    const cajas = db.prepare(`
      SELECT c.id, c.nombre, s.nombre AS sucursal,
             t.id AS turno_id, t.estado AS turno_estado,
             t.apertura_at, t.monto_apertura, t.usuario_id,
             u.nombre AS cajero
      FROM cajas c
      JOIN sucursales s ON s.id = c.sucursal_id
      LEFT JOIN turnos_caja t ON t.caja_id = c.id AND t.estado = 'abierto'
      LEFT JOIN usuarios u ON u.id = t.usuario_id
      WHERE s.activa = 1
      ORDER BY c.id
    `).all() as Record<string, unknown>[]

    return ok(res, cajas.map(c => ({
      cajaId: c.id,
      nombre: c.nombre,
      sucursal: c.sucursal,
      turnoAbierto: c.turno_estado === 'abierto',
      turnoId: c.turno_id,
      apertura: c.apertura_at,
      montoApertura: c.monto_apertura,
      cajero: c.cajero,
    })))
  }

  if (pathParts[3] === 'turno' && pathParts[4]) {
    const cajaId = Number(pathParts[4])
    const turno = db.prepare(
      "SELECT * FROM turnos_caja WHERE caja_id = ? AND estado = 'abierto' LIMIT 1"
    ).get(cajaId) as Record<string, unknown> | undefined
    if (!turno) return error(res, 404, 'Sin turno abierto para esta caja')

    const totalVentas = (db.prepare(`
      SELECT COUNT(*) as c, COALESCE(SUM(total), 0) AS total
      FROM ventas WHERE turno_id = ? AND estado = 'completada'
    `).get(turno.id) as { c: number; total: number })

    return ok(res, {
      id: turno.id,
      cajaId: turno.caja_id,
      usuarioId: turno.usuario_id,
      estado: turno.estado,
      apertura: turno.apertura_at,
      montoApertura: turno.monto_apertura,
      cantidadVentas: totalVentas.c,
      totalRecaudado: totalVentas.total,
    })
  }

  // GET /api/v1/caja/ventas-hoy
  if (pathParts[3] === 'ventas-hoy') {
    const query = parseQuery(_req.url ?? '')
    const fecha = (query.fecha as string | undefined) ?? new Date().toISOString().slice(0, 10)
    const row = db.prepare(`
      SELECT COUNT(*) as c, COALESCE(SUM(total), 0) AS total
      FROM ventas WHERE date(fecha) = date(?) AND estado = 'completada'
    `).get(fecha) as { c: number; total: number }
    return ok(res, { fecha, cantidad: row.c, total: row.total })
  }

  error(res, 404, 'Ruta no encontrada')
}
