import { handle } from './base'
import { getSqlite } from '../db/database'
import type { Usuario } from '../../shared/types'

export function registerUsuariosHandlers(): void {
  handle('usuarios:login', ({ pin }) => {
    const db = getSqlite()
    const row = db.prepare('SELECT * FROM usuarios WHERE pin = ? AND activo = 1 LIMIT 1').get(pin)
    if (!row) throw new Error('PIN incorrecto')
    return mapUsuario(row as Record<string, unknown>)
  })

  handle('usuarios:list', () => {
    const db = getSqlite()
    const rows = db.prepare('SELECT * FROM usuarios WHERE activo = 1 ORDER BY nombre').all() as Record<string, unknown>[]
    return rows.map(mapUsuario)
  })

  handle('usuarios:create', (data) => {
    const db = getSqlite()
    if (data.pin.length < 4 || data.pin.length > 6 || !/^\d+$/.test(data.pin)) {
      throw new Error('El PIN debe ser numérico de 4 a 6 dígitos')
    }
    const existing = db.prepare('SELECT id FROM usuarios WHERE pin = ? AND negocio_id = ?').get(data.pin, data.negocioId)
    if (existing) throw new Error('Ya existe un usuario con ese PIN')

    const result = db.prepare(
      'INSERT INTO usuarios (negocio_id, nombre, pin, rol) VALUES (?, ?, ?, ?)'
    ).run(data.negocioId, data.nombre, data.pin, data.rol)
    const row = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(result.lastInsertRowid)
    return mapUsuario(row as Record<string, unknown>)
  })
}

function mapUsuario(row: Record<string, unknown>): Usuario {
  return {
    id: row.id as number,
    negocioId: row.negocio_id as number,
    nombre: row.nombre as string,
    pin: row.pin as string,
    rol: row.rol as Usuario['rol'],
    activo: Boolean(row.activo),
  }
}
