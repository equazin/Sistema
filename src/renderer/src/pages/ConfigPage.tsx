import { useEffect, useState, useCallback } from 'react'
import { invoke } from '../lib/api'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import type { Negocio } from '../../../shared/types'

type FormData = {
  nombre: string
  razonSocial: string
  cuit: string
  condicionAfip: Negocio['condicionAfip']
  domicilio: string
  telefono: string
}

function toForm(n: Negocio | null): FormData {
  return {
    nombre:        n?.nombre        ?? '',
    razonSocial:   n?.razonSocial   ?? '',
    cuit:          n?.cuit          ?? '',
    condicionAfip: n?.condicionAfip ?? 'monotributo',
    domicilio:     n?.domicilio     ?? '',
    telefono:      n?.telefono      ?? '',
  }
}

export function ConfigPage(): JSX.Element {
  const [form, setForm] = useState<FormData>(toForm(null))
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    invoke('negocio:get', {}).then((n) => {
      if (n) setForm(toForm(n))
      setIsLoading(false)
    })
  }, [])

  const set = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }, [])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      await invoke('negocio:save', form)
      setSaved(true)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setIsSaving(false)
    }
  }, [form])

  if (isLoading) {
    return <div className="flex items-center justify-center h-full text-slate-400">Cargando...</div>
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Configuración del negocio</h1>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Nombre comercial"
            value={form.nombre}
            onChange={(e) => set('nombre', e.target.value)}
            placeholder="Mi Kiosco"
          />
          <Input
            label="Razón social"
            value={form.razonSocial}
            onChange={(e) => set('razonSocial', e.target.value)}
            placeholder="Juan Pérez"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="CUIT"
            value={form.cuit}
            onChange={(e) => set('cuit', e.target.value)}
            placeholder="20-12345678-9"
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Condición AFIP</label>
            <select
              value={form.condicionAfip}
              onChange={(e) => set('condicionAfip', e.target.value as Negocio['condicionAfip'])}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              <option value="monotributo">Monotributo</option>
              <option value="responsable_inscripto">Responsable Inscripto</option>
              <option value="exento">Exento</option>
              <option value="consumidor_final">Consumidor Final</option>
            </select>
          </div>
        </div>

        <Input
          label="Domicilio"
          value={form.domicilio}
          onChange={(e) => set('domicilio', e.target.value)}
          placeholder="Av. Corrientes 1234, CABA"
        />

        <Input
          label="Teléfono"
          value={form.telefono}
          onChange={(e) => set('telefono', e.target.value)}
          placeholder="11 1234-5678"
        />

        <div className="flex items-center gap-4 pt-2 border-t border-slate-100">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Guardando...' : 'Guardar configuración'}
          </Button>
          {saved && <span className="text-green-600 text-sm font-medium">✓ Guardado</span>}
        </div>
      </div>

      <div className="mt-6 bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-700 mb-3">Información del sistema</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <InfoRow label="Versión" value="1.0.0 (Fase 1 MVP)" />
          <InfoRow label="Base de datos" value="SQLite + WAL mode" />
          <InfoRow label="PIN por defecto" value="1234 (cambiarlo en producción)" />
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <p className="text-slate-500 text-xs">{label}</p>
      <p className="text-slate-700 font-medium">{value}</p>
    </div>
  )
}
