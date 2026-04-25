import type Database from 'better-sqlite3'
import type { Permiso } from '../../shared/permissions'
import { tienePermiso } from '../../shared/permissions'
import type { Usuario } from '../../shared/types'

export function assertPermisoUsuario(
  db: Database.Database,
  usuarioId: number,
  permiso: Permiso
): void {
  const usuario = db.prepare('SELECT rol, activo FROM usuarios WHERE id = ?').get(usuarioId) as
    | Pick<Usuario, 'rol' | 'activo'>
    | undefined

  if (!usuario || !tienePermiso(usuario, permiso)) {
    throw new Error('No tenés permiso para realizar esta acción')
  }
}
