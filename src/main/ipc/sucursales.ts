import { handle } from './base'
import { getSqlite } from '../db/database'
import type { Sucursal } from '../../shared/types'

function mapSucursal(r: Record<string, unknown>): Sucursal {
  return {
    id: r.id as number,
    negocioId: r.negocio_id as number,
    nombre: r.nombre as string,
    domicilio: (r.domicilio as string) ?? '',
    activa: Boolean(r.activa),
  }
}

export function registerSucursalesHandlers(): void {
  handle('sucursales:list', () => {
    const db = getSqlite()
    const rows = db.prepare('SELECT * FROM sucursales ORDER BY nombre').all() as Record<string, unknown>[]
    return rows.map(mapSucursal)
  })

  handle('sucursales:create', ({ nombre, domicilio }) => {
    const db = getSqlite()
    const negocio = db.prepare('SELECT id FROM negocios LIMIT 1').get() as { id: number }
    const result = db.prepare(
      'INSERT INTO sucursales (negocio_id, nombre, domicilio) VALUES (?, ?, ?)'
    ).run(negocio.id, nombre, domicilio ?? '')
    const row = db.prepare('SELECT * FROM sucursales WHERE id = ?').get(result.lastInsertRowid) as Record<string, unknown>
    return mapSucursal(row)
  })

  handle('sucursales:update', ({ id, nombre, domicilio, activa }) => {
    const db = getSqlite()
    if (nombre !== undefined) db.prepare('UPDATE sucursales SET nombre = ? WHERE id = ?').run(nombre, id)
    if (domicilio !== undefined) db.prepare('UPDATE sucursales SET domicilio = ? WHERE id = ?').run(domicilio, id)
    if (activa !== undefined) db.prepare('UPDATE sucursales SET activa = ? WHERE id = ?').run(activa ? 1 : 0, id)
    const row = db.prepare('SELECT * FROM sucursales WHERE id = ?').get(id) as Record<string, unknown>
    if (!row) throw new Error('Sucursal no encontrada')
    return mapSucursal(row)
  })

  handle('sucursales:delete', ({ id }) => {
    const db = getSqlite()
    const hasCajas = db.prepare('SELECT COUNT(*) as c FROM cajas WHERE sucursal_id = ?').get(id) as { c: number }
    if (hasCajas.c > 0) throw new Error('No se puede eliminar una sucursal que tiene cajas asociadas')
    db.prepare('DELETE FROM sucursales WHERE id = ?').run(id)
  })
}
