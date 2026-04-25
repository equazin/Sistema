import type { RolUsuario, Usuario } from './types'

export type Permiso =
  | 'pos:usar'
  | 'productos:gestionar'
  | 'stock:ajustar'
  | 'caja:abrir'
  | 'caja:cerrar'
  | 'clientes:gestionar'
  | 'proveedores:gestionar'
  | 'compras:gestionar'
  | 'reportes:ver'
  | 'usuarios:gestionar'
  | 'promociones:gestionar'
  | 'precios:actualizar'
  | 'config:gestionar'
  | 'auditoria:ver'

const PERMISOS_POR_ROL: Record<RolUsuario, readonly Permiso[]> = {
  admin: [
    'pos:usar',
    'productos:gestionar',
    'stock:ajustar',
    'caja:abrir',
    'caja:cerrar',
    'clientes:gestionar',
    'proveedores:gestionar',
    'compras:gestionar',
    'reportes:ver',
    'usuarios:gestionar',
    'promociones:gestionar',
    'precios:actualizar',
    'config:gestionar',
    'auditoria:ver',
  ],
  encargado: [
    'pos:usar',
    'productos:gestionar',
    'stock:ajustar',
    'caja:abrir',
    'caja:cerrar',
    'clientes:gestionar',
    'proveedores:gestionar',
    'compras:gestionar',
    'reportes:ver',
    'promociones:gestionar',
  ],
  cajero: [
    'pos:usar',
    'caja:abrir',
    'clientes:gestionar',
  ],
  lectura: [
    'reportes:ver',
  ],
}

export function tienePermiso(usuario: Pick<Usuario, 'rol' | 'activo'> | null | undefined, permiso: Permiso): boolean {
  if (!usuario?.activo) return false
  return PERMISOS_POR_ROL[usuario.rol].includes(permiso)
}

export function permisosDeRol(rol: RolUsuario): readonly Permiso[] {
  return PERMISOS_POR_ROL[rol]
}
