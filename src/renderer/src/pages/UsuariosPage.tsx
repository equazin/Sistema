import { useState, useEffect, useCallback } from 'react'
import { invoke } from '../lib/api'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Badge } from '../components/ui/Badge'
import { useAuthStore } from '../stores/auth.store'
import type { AuditoriaEntry, Usuario, RolUsuario } from '../../../shared/types'

const ROL_LABELS: Record<RolUsuario, string> = {
  admin: 'Administrador',
  encargado: 'Encargado',
  cajero: 'Cajero',
  lectura: 'Solo lectura',
}

const ROL_VARIANT: Record<RolUsuario, 'danger' | 'warning' | 'info' | 'default'> = {
  admin: 'danger',
  encargado: 'warning',
  cajero: 'info',
  lectura: 'default',
}

type ModalMode = 'crear' | 'editar' | null

export function UsuariosPage(): JSX.Element {
  const { usuario: usuarioActual } = useAuthStore()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [auditoria, setAuditoria] = useState<AuditoriaEntry[]>([])
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [usuarioSel, setUsuarioSel] = useState<Usuario | null>(null)

  const [form, setForm] = useState({
    nombre: '',
    pin: '',
    pinConfirm: '',
    rol: 'cajero' as RolUsuario,
    activo: true,
  })

  const cargar = useCallback(async () => {
    setIsLoading(true)
    try {
      const [res, audit] = await Promise.all([
        invoke('usuarios:listAll', {}),
        invoke('auditoria:list', { limit: 30 }),
      ])
      setUsuarios(res)
      setAuditoria(audit)
    } finally { setIsLoading(false) }
  }, [])

  useEffect(() => { cargar() }, [])

  const abrirCrear = useCallback(() => {
    setForm({ nombre: '', pin: '', pinConfirm: '', rol: 'cajero', activo: true })
    setUsuarioSel(null)
    setModalMode('crear')
  }, [])

  const abrirEditar = useCallback((u: Usuario) => {
    setForm({ nombre: u.nombre, pin: '', pinConfirm: '', rol: u.rol, activo: u.activo })
    setUsuarioSel(u)
    setModalMode('editar')
  }, [])

  const handleGuardar = useCallback(async () => {
    if (!form.nombre.trim()) return alert('El nombre es obligatorio')
    if (modalMode === 'crear' && !form.pin) return alert('El PIN es obligatorio')
    if (form.pin && form.pin !== form.pinConfirm) return alert('Los PINs no coinciden')
    if (form.pin && (form.pin.length < 4 || form.pin.length > 6 || !/^\d+$/.test(form.pin))) {
      return alert('El PIN debe ser numérico de 4 a 6 dígitos')
    }

    try {
      if (modalMode === 'crear') {
        await invoke('usuarios:create', {
          negocioId: usuarioActual?.negocioId ?? 1,
          nombre: form.nombre.trim(),
          pin: form.pin,
          rol: form.rol,
          activo: form.activo,
        })
      } else if (usuarioSel) {
        await invoke('usuarios:update', {
          id: usuarioSel.id,
          nombre: form.nombre.trim(),
          rol: form.rol,
          activo: form.activo,
          ...(form.pin ? { pin: form.pin, negocioId: usuarioActual?.negocioId ?? 1 } : {}),
        })
      }
      setModalMode(null)
      cargar()
    } catch (err) { alert(err instanceof Error ? err.message : 'Error al guardar') }
  }, [form, modalMode, usuarioSel, usuarioActual, cargar])

  const handleEliminar = useCallback(async (u: Usuario) => {
    if (u.id === usuarioActual?.id) return alert('No podés eliminar tu propio usuario')
    if (!confirm(`¿Eliminar usuario ${u.nombre}?`)) return
    try {
      await invoke('usuarios:delete', { id: u.id })
      cargar()
    } catch (err) { alert(err instanceof Error ? err.message : 'Error') }
  }, [usuarioActual, cargar])

  const esAdmin = usuarioActual?.rol === 'admin'

  if (!esAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400">
        <p className="text-4xl mb-4">🔒</p>
        <p className="text-xl font-semibold">Acceso restringido</p>
        <p className="text-sm mt-2">Solo los administradores pueden gestionar usuarios</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Usuarios y Permisos</h1>
          <p className="text-sm text-slate-500 mt-1">Gestión de accesos al sistema</p>
        </div>
        <Button onClick={abrirCrear}>+ Nuevo usuario</Button>
      </div>

      {/* Info de roles */}
      <div className="grid grid-cols-4 gap-3">
        {(Object.entries(ROL_LABELS) as [RolUsuario, string][]).map(([rol, label]) => (
          <div key={rol} className="bg-white rounded-xl border border-slate-200 p-3">
            <Badge variant={ROL_VARIANT[rol]}>{label}</Badge>
            <p className="text-xs text-slate-400 mt-2">{getRolDescription(rol)}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 text-slate-600 font-semibold">Nombre</th>
              <th className="text-left px-4 py-3 text-slate-600 font-semibold">Rol</th>
              <th className="text-left px-4 py-3 text-slate-600 font-semibold">PIN</th>
              <th className="text-left px-4 py-3 text-slate-600 font-semibold">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} className="text-center py-8 text-slate-400">Cargando...</td></tr>}
            {!isLoading && usuarios.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-slate-400">Sin usuarios</td></tr>}
            {usuarios.map(u => (
              <tr key={u.id} className={`border-b border-slate-100 last:border-0 ${u.id === usuarioActual?.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800">{u.nombre}</span>
                    {u.id === usuarioActual?.id && <span className="text-xs text-blue-500">(vos)</span>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={ROL_VARIANT[u.rol]}>{ROL_LABELS[u.rol]}</Badge>
                </td>
                <td className="px-4 py-3 text-slate-400 font-mono">{'•'.repeat(u.pin.length)}</td>
                <td className="px-4 py-3">
                  <Badge variant={u.activo ? 'success' : 'default'}>{u.activo ? 'Activo' : 'Inactivo'}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="outline" onClick={() => abrirEditar(u)}>Editar</Button>
                    {u.id !== usuarioActual?.id && (
                      <Button size="sm" variant="destructive" onClick={() => handleEliminar(u)}>Eliminar</Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h2 className="font-semibold text-slate-700">Auditoría reciente</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-white border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 text-slate-600 font-semibold">Fecha</th>
              <th className="text-left px-4 py-3 text-slate-600 font-semibold">Usuario</th>
              <th className="text-left px-4 py-3 text-slate-600 font-semibold">Acción</th>
              <th className="text-left px-4 py-3 text-slate-600 font-semibold">Referencia</th>
            </tr>
          </thead>
          <tbody>
            {auditoria.length === 0 && (
              <tr><td colSpan={4} className="text-center py-6 text-slate-400">Sin eventos registrados</td></tr>
            )}
            {auditoria.map((a) => (
              <tr key={a.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-500">{new Date(a.fecha).toLocaleString('es-AR')}</td>
                <td className="px-4 py-3 text-slate-700">{a.nombreUsuario ?? 'Sistema'}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">{formatAccion(a.accion)}</p>
                  {a.detalle && <p className="text-xs text-slate-400 truncate max-w-md">{formatDetalle(a.detalle)}</p>}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {a.tabla ? `${a.tabla}${a.referenciaId ? ` #${a.referenciaId}` : ''}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={modalMode !== null}
        onClose={() => setModalMode(null)}
        title={modalMode === 'crear' ? 'Nuevo usuario' : 'Editar usuario'}
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <Input label="Nombre" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Rol</label>
            <select
              value={form.rol}
              onChange={e => setForm(f => ({ ...f, rol: e.target.value as RolUsuario }))}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            >
              {(Object.entries(ROL_LABELS) as [RolUsuario, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <Input
            label={modalMode === 'editar' ? 'Nuevo PIN (dejar vacío para no cambiar)' : 'PIN *'}
            value={form.pin}
            onChange={e => setForm(f => ({ ...f, pin: e.target.value }))}
            inputMode="numeric"
            type="password"
          />
          {form.pin && (
            <Input
              label="Confirmar PIN"
              value={form.pinConfirm}
              onChange={e => setForm(f => ({ ...f, pinConfirm: e.target.value }))}
              inputMode="numeric"
              type="password"
            />
          )}

          {modalMode === 'editar' && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.activo}
                onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm text-slate-700">Usuario activo</span>
            </label>
          )}

          <div className="flex gap-3 justify-end mt-2">
            <Button variant="outline" onClick={() => setModalMode(null)}>Cancelar</Button>
            <Button onClick={handleGuardar}>Guardar</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function getRolDescription(rol: RolUsuario): string {
  switch (rol) {
    case 'admin': return 'Acceso total. Configura el sistema, gestiona usuarios y reportes.'
    case 'encargado': return 'Puede ver reportes, anular ventas y gestionar stock.'
    case 'cajero': return 'Acceso al POS, caja y consulta de productos.'
    case 'lectura': return 'Solo puede consultar información, sin modificar.'
  }
}

function formatAccion(accion: string): string {
  return accion
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatDetalle(detalle: string): string {
  try {
    const parsed = JSON.parse(detalle) as Record<string, unknown>
    return Object.entries(parsed)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(' · ')
  } catch {
    return detalle
  }
}
