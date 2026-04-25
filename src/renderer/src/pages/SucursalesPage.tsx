import { useEffect, useState, useCallback } from 'react'
import { invoke } from '../lib/api'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import type { Sucursal } from '../../../shared/types'

export function SucursalesPage(): JSX.Element {
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ nombre: '', domicilio: '' })
  const [editando, setEditando] = useState<Sucursal | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    const lista = await invoke('sucursales:list', {})
    setSucursales(lista)
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const handleGuardar = useCallback(async () => {
    if (!form.nombre.trim()) { setError('El nombre es requerido'); return }
    setGuardando(true); setError(null)
    try {
      if (editando) {
        await invoke('sucursales:update', { id: editando.id, nombre: form.nombre, domicilio: form.domicilio })
      } else {
        await invoke('sucursales:create', { nombre: form.nombre, domicilio: form.domicilio })
      }
      setForm({ nombre: '', domicilio: '' })
      setEditando(null)
      await cargar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }, [form, editando, cargar])

  const handleEditar = useCallback((s: Sucursal) => {
    setEditando(s)
    setForm({ nombre: s.nombre, domicilio: s.domicilio })
    setError(null)
  }, [])

  const handleToggleActiva = useCallback(async (s: Sucursal) => {
    try {
      await invoke('sucursales:update', { id: s.id, activa: !s.activa })
      await cargar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar')
    }
  }, [cargar])

  const handleEliminar = useCallback(async (s: Sucursal) => {
    if (!confirm(`¿Eliminar sucursal "${s.nombre}"? Esta acción no se puede deshacer.`)) return
    try {
      await invoke('sucursales:delete', { id: s.id })
      await cargar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar')
    }
  }, [cargar])

  const handleCancelar = useCallback(() => {
    setEditando(null)
    setForm({ nombre: '', domicilio: '' })
    setError(null)
  }, [])

  if (loading) return <div className="flex items-center justify-center h-full text-slate-400">Cargando...</div>

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Sucursales</h1>

      {/* Form */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col gap-4">
        <h2 className="font-semibold text-slate-700">{editando ? `Editar: ${editando.nombre}` : 'Nueva sucursal'}</h2>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Nombre" value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} placeholder="Casa Central" />
          <Input label="Domicilio" value={form.domicilio} onChange={(e) => setForm((f) => ({ ...f, domicilio: e.target.value }))} placeholder="Av. Corrientes 1234" />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex gap-2 pt-2 border-t border-slate-100">
          <Button onClick={handleGuardar} disabled={guardando}>{guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear sucursal'}</Button>
          {editando && <Button variant="outline" onClick={handleCancelar}>Cancelar</Button>}
        </div>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
        {sucursales.length === 0 ? (
          <p className="text-slate-400 text-sm p-6">No hay sucursales registradas.</p>
        ) : sucursales.map((s) => (
          <div key={s.id} className="flex items-center justify-between p-4">
            <div>
              <p className={`font-medium text-slate-800 ${!s.activa ? 'line-through text-slate-400' : ''}`}>{s.nombre}</p>
              {s.domicilio && <p className="text-xs text-slate-500">{s.domicilio}</p>}
              <span className={`text-xs font-medium ${s.activa ? 'text-green-600' : 'text-slate-400'}`}>
                {s.activa ? 'Activa' : 'Inactiva'}
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleEditar(s)}>Editar</Button>
              <Button variant="outline" size="sm" onClick={() => handleToggleActiva(s)}>
                {s.activa ? 'Desactivar' : 'Activar'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleEliminar(s)}>Eliminar</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
