import { handle } from './base'
import { getSqlite } from '../db/database'
import type { Usuario } from '../../shared/types'
import { registrarAuditoria } from './auditoria'

export function registerUsuariosAdminHandlers(): void {
  handle('usuarios:update', ({ id, ...data }) => {
    const db = getSqlite()
    if (data.pin) {
      if (data.pin.length < 4 || data.pin.length > 6 || !/^\d+$/.test(data.pin)) {
        throw new Error('El PIN debe ser numérico de 4 a 6 dígitos')
      }
      const existing = db.prepare('SELECT id FROM usuarios WHERE pin = ? AND negocio_id = ? AND id != ?').get(data.pin, data.negocioId ?? 1, id)
      if (existing) throw new Error('Ya existe un usuario con ese PIN')
    }

    db.prepare(`
      UPDATE usuarios
      SET nombre = ?,
          rol = ?,
          ${data.pin ? 'pin = ?,' : ''}
          activo = ?
      WHERE id = ?
    `.replace(/,\s*WHERE/, ' WHERE')).run(
      ...(data.pin
        ? [data.nombre, data.rol, data.pin, data.activo ? 1 : 0, id]
        : [data.nombre, data.rol, data.activo ? 1 : 0, id])
    )
    registrarAuditoria(db, {
      accion: 'usuario_actualizado',
      tabla: 'usuarios',
      referenciaId: id,
      detalle: { nombre: data.nombre, rol: data.rol, activo: data.activo, cambioPin: Boolean(data.pin) },
    })

    const row = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id)
    return mapUsuario(row as Record<string, unknown>)
  })

  handle('usuarios:delete', ({ id }) => {
    const db = getSqlite()
    const admins = db.prepare("SELECT COUNT(*) as c FROM usuarios WHERE rol = 'admin' AND activo = 1").get() as { c: number }
    const target = db.prepare('SELECT rol FROM usuarios WHERE id = ?').get(id) as { rol: string } | undefined
    if (target?.rol === 'admin' && admins.c <= 1) {
      throw new Error('No se puede eliminar el único administrador')
    }
    db.prepare('UPDATE usuarios SET activo = 0 WHERE id = ?').run(id)
    registrarAuditoria(db, {
      accion: 'usuario_desactivado',
      tabla: 'usuarios',
      referenciaId: id,
    })
  })

  handle('usuarios:listAll', () => {
    const db = getSqlite()
    const rows = db.prepare('SELECT * FROM usuarios ORDER BY rol, nombre').all() as Record<string, unknown>[]
    return rows.map(mapUsuario)
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
