import { describe, expect, it } from 'vitest'
import { tienePermiso } from '../src/shared/permissions'

describe('permisos por rol', () => {
  it('admin puede gestionar usuarios y configuracion', () => {
    const usuario = { rol: 'admin' as const, activo: true }

    expect(tienePermiso(usuario, 'usuarios:gestionar')).toBe(true)
    expect(tienePermiso(usuario, 'config:gestionar')).toBe(true)
  })

  it('encargado puede cerrar caja pero no actualizar precios masivos', () => {
    const usuario = { rol: 'encargado' as const, activo: true }

    expect(tienePermiso(usuario, 'caja:cerrar')).toBe(true)
    expect(tienePermiso(usuario, 'precios:actualizar')).toBe(false)
  })

  it('cajero puede usar POS y abrir caja, pero no cerrarla', () => {
    const usuario = { rol: 'cajero' as const, activo: true }

    expect(tienePermiso(usuario, 'pos:usar')).toBe(true)
    expect(tienePermiso(usuario, 'caja:abrir')).toBe(true)
    expect(tienePermiso(usuario, 'caja:cerrar')).toBe(false)
  })

  it('lectura solo accede a reportes', () => {
    const usuario = { rol: 'lectura' as const, activo: true }

    expect(tienePermiso(usuario, 'reportes:ver')).toBe(true)
    expect(tienePermiso(usuario, 'pos:usar')).toBe(false)
  })

  it('usuario inactivo no tiene permisos', () => {
    const usuario = { rol: 'admin' as const, activo: false }

    expect(tienePermiso(usuario, 'usuarios:gestionar')).toBe(false)
  })
})
