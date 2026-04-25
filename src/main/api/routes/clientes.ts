import type { IncomingMessage, ServerResponse } from 'http'
import { ok, error } from '../response'
import { getSqlite } from '../../db/database'
import { parseQuery, parsePagination } from '../router'

export function handleClientes(req: IncomingMessage, res: ServerResponse, pathParts: string[]): void {
  const db = getSqlite()

  if (pathParts[3] && !isNaN(Number(pathParts[3]))) {
    const id = Number(pathParts[3])
    const cliente = db.prepare('SELECT * FROM clientes WHERE id = ? AND activo = 1').get(id) as Record<string, unknown> | undefined
    if (!cliente) return error(res, 404, 'Cliente no encontrado')
    return ok(res, mapCliente(cliente))
  }

  const query = parseQuery(req.url ?? '')
  const { page, limit, offset } = parsePagination(query)
  const search = (query.search as string | undefined) ?? ''
  const conDeuda = query.con_deuda === '1'

  const conditions = ['activo = 1']
  const params: unknown[] = []
  if (search) { conditions.push('(nombre LIKE ? OR cuit_dni LIKE ?)'); params.push(`%${search}%`, `%${search}%`) }
  if (conDeuda) { conditions.push('saldo_cuenta_corriente > 0') }
  const where = `WHERE ${conditions.join(' AND ')}`

  const total = (db.prepare(`SELECT COUNT(*) as c FROM clientes ${where}`).get(...params) as { c: number }).c
  const rows = db.prepare(`SELECT * FROM clientes ${where} ORDER BY nombre LIMIT ? OFFSET ?`).all(...params, limit, offset) as Record<string, unknown>[]

  ok(res, rows.map(mapCliente), { total, page, limit })
}

function mapCliente(r: Record<string, unknown>) {
  return {
    id: r.id,
    nombre: r.nombre,
    cuitDni: r.cuit_dni,
    telefono: r.telefono,
    email: r.email,
    limiteCredito: r.limite_credito,
    saldoCuentaCorriente: r.saldo_cuenta_corriente,
  }
}
