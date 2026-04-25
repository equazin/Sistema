import { useEffect, useState, useCallback } from 'react'
import { invoke } from '../lib/api'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import type { Negocio } from '../../../shared/types'

type MpFormData = { accessToken: string; posId: string; sucursalId: string }
type BackupConfig = { carpeta: string; frecuencia: 'diario' | 'semanal' | 'manual' }
type FormData = {
  nombre: string; razonSocial: string; cuit: string
  condicionAfip: Negocio['condicionAfip']; domicilio: string; telefono: string
}
type UpdaterEstado = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'up_to_date' | 'error'
interface UpdaterInfo {
  estado: UpdaterEstado; version?: string; progreso?: number; velocidad?: number; mensaje?: string
}

function toForm(n: Negocio | null): FormData {
  return {
    nombre: n?.nombre ?? '', razonSocial: n?.razonSocial ?? '',
    cuit: n?.cuit ?? '', condicionAfip: n?.condicionAfip ?? 'monotributo',
    domicilio: n?.domicilio ?? '', telefono: n?.telefono ?? '',
  }
}

export function ConfigPage(): JSX.Element {
  const [form, setForm] = useState<FormData>(toForm(null))
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [mpForm, setMpForm] = useState<MpFormData>({ accessToken: '', posId: '', sucursalId: '' })
  const [isSavingMp, setIsSavingMp] = useState(false)
  const [savedMp, setSavedMp] = useState(false)
  const [mpError, setMpError] = useState<string | null>(null)

  const [backupConfig, setBackupConfig] = useState<BackupConfig>({ carpeta: '', frecuencia: 'diario' })
  const [backupLoading, setBackupLoading] = useState(false)
  const [backupMensaje, setBackupMensaje] = useState<string | null>(null)
  const [backups, setBackups] = useState<{ nombre: string; fecha: string; tamaño: number }[]>([])

  const [updater, setUpdater] = useState<UpdaterInfo>({ estado: 'idle' })

  useEffect(() => {
    invoke('negocio:get', {}).then((n) => { if (n) setForm(toForm(n)); setIsLoading(false) })
    invoke('config:mp:get', {}).then((mp) => { if (mp) setMpForm(mp) }).catch(() => {})
    invoke('backup:getConfig', {}).then((cfg) => { if (cfg) setBackupConfig(cfg) }).catch(() => {})
    invoke('backup:listar', {}).then(setBackups).catch(() => {})

    const unsub = window.api.on('updater:status', (data) => {
      setUpdater(data as UpdaterInfo)
    })
    return unsub
  }, [])

  const set = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value })); setSaved(false)
  }, [])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try { await invoke('negocio:save', form); setSaved(true) }
    catch (err) { alert(err instanceof Error ? err.message : 'Error al guardar') }
    finally { setIsSaving(false) }
  }, [form])

  const setMp = useCallback(<K extends keyof MpFormData>(key: K, value: MpFormData[K]) => {
    setMpForm((prev) => ({ ...prev, [key]: value })); setSavedMp(false); setMpError(null)
  }, [])

  const handleSaveMp = useCallback(async () => {
    setIsSavingMp(true); setMpError(null)
    try { await invoke('config:mp:set', mpForm); setSavedMp(true) }
    catch (err) { setMpError(err instanceof Error ? err.message : 'Error al guardar') }
    finally { setIsSavingMp(false) }
  }, [mpForm])

  const handleSeleccionarCarpeta = useCallback(async () => {
    const carpeta = await window.api.invokeRaw('backup:seleccionarCarpeta') as string | null
    if (carpeta) setBackupConfig((c) => ({ ...c, carpeta }))
  }, [])

  const handleGuardarBackup = useCallback(async () => {
    await invoke('backup:setConfig', backupConfig)
    setBackupMensaje('✓ Configuración guardada')
    setTimeout(() => setBackupMensaje(null), 2000)
  }, [backupConfig])

  const handleEjecutarBackup = useCallback(async () => {
    setBackupLoading(true); setBackupMensaje(null)
    try {
      const result = await invoke('backup:ejecutar', { destino: backupConfig.carpeta || undefined })
      const lista = await invoke('backup:listar', {})
      setBackups(lista)
      setBackupMensaje(`✓ Backup creado: ${result.path.split(/[\\/]/).pop()}`)
    } catch (err) {
      setBackupMensaje(`Error: ${err instanceof Error ? err.message : 'Error desconocido'}`)
    } finally {
      setBackupLoading(false)
    }
  }, [backupConfig.carpeta])

  const handleCheckUpdate = useCallback(async () => {
    setUpdater({ estado: 'checking' })
    await window.api.invokeRaw('updater:checkForUpdates')
  }, [])

  const handleDescargar = useCallback(async () => {
    await window.api.invokeRaw('updater:descargar')
  }, [])

  const handleInstalar = useCallback(async () => {
    await window.api.invokeRaw('updater:instalar')
  }, [])

  if (isLoading) return <div className="flex items-center justify-center h-full text-slate-400">Cargando...</div>

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Configuración</h1>

      {/* Datos del negocio */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col gap-5">
        <h2 className="font-semibold text-slate-700">Datos del negocio</h2>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Nombre comercial" value={form.nombre} onChange={(e) => set('nombre', e.target.value)} placeholder="Mi Kiosco" />
          <Input label="Razón social" value={form.razonSocial} onChange={(e) => set('razonSocial', e.target.value)} placeholder="Juan Pérez" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="CUIT" value={form.cuit} onChange={(e) => set('cuit', e.target.value)} placeholder="20-12345678-9" />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Condición AFIP</label>
            <select value={form.condicionAfip} onChange={(e) => set('condicionAfip', e.target.value as Negocio['condicionAfip'])}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500">
              <option value="monotributo">Monotributo</option>
              <option value="responsable_inscripto">Responsable Inscripto</option>
              <option value="exento">Exento</option>
              <option value="consumidor_final">Consumidor Final</option>
            </select>
          </div>
        </div>
        <Input label="Domicilio" value={form.domicilio} onChange={(e) => set('domicilio', e.target.value)} placeholder="Av. Corrientes 1234, CABA" />
        <Input label="Teléfono" value={form.telefono} onChange={(e) => set('telefono', e.target.value)} placeholder="11 1234-5678" />
        <div className="flex items-center gap-4 pt-2 border-t border-slate-100">
          <Button onClick={handleSave} disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar'}</Button>
          {saved && <span className="text-green-600 text-sm font-medium">✓ Guardado</span>}
        </div>
      </div>

      {/* MercadoPago */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col gap-5">
        <div>
          <h2 className="font-semibold text-slate-700 mb-1">MercadoPago QR</h2>
          <p className="text-xs text-slate-500">Credenciales para habilitar cobros con QR dinámico.</p>
        </div>
        <Input label="Access Token" value={mpForm.accessToken} onChange={(e) => setMp('accessToken', e.target.value)} placeholder="APP_USR-..." type="password" />
        <div className="grid grid-cols-2 gap-4">
          <Input label="POS ID" value={mpForm.posId} onChange={(e) => setMp('posId', e.target.value)} placeholder="CAJA001" />
          <Input label="Sucursal ID" value={mpForm.sucursalId} onChange={(e) => setMp('sucursalId', e.target.value)} placeholder="SUCURSAL001" />
        </div>
        {mpError && <p className="text-red-500 text-sm">{mpError}</p>}
        <div className="flex items-center gap-4 pt-2 border-t border-slate-100">
          <Button onClick={handleSaveMp} disabled={isSavingMp}>{isSavingMp ? 'Guardando...' : 'Guardar credenciales'}</Button>
          {savedMp && <span className="text-green-600 text-sm font-medium">✓ Guardado</span>}
        </div>
      </div>

      {/* Backup */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col gap-5">
        <div>
          <h2 className="font-semibold text-slate-700 mb-1">Backup automático</h2>
          <p className="text-xs text-slate-500">La base de datos se copia a la carpeta seleccionada. Se conservan los últimos 30 backups.</p>
        </div>
        <div className="flex gap-2">
          <input readOnly value={backupConfig.carpeta || '(carpeta por defecto — userData/backups)'}
            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-500" />
          <Button variant="outline" onClick={handleSeleccionarCarpeta}>Seleccionar carpeta</Button>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-600 font-medium">Frecuencia</label>
          <select value={backupConfig.frecuencia} onChange={(e) => setBackupConfig((c) => ({ ...c, frecuencia: e.target.value as BackupConfig['frecuencia'] }))}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm">
            <option value="diario">Diario (automático)</option>
            <option value="semanal">Semanal (automático)</option>
            <option value="manual">Solo manual</option>
          </select>
        </div>
        {backupMensaje && (
          <p className={`text-sm font-medium ${backupMensaje.startsWith('Error') ? 'text-red-500' : 'text-green-600'}`}>{backupMensaje}</p>
        )}
        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <Button onClick={handleGuardarBackup}>Guardar configuración</Button>
          <Button variant="outline" onClick={handleEjecutarBackup} disabled={backupLoading}>
            {backupLoading ? 'Haciendo backup...' : '💾 Hacer backup ahora'}
          </Button>
        </div>
        {backups.length > 0 && (
          <details className="mt-1">
            <summary className="text-sm text-slate-500 cursor-pointer select-none hover:text-slate-700">
              Ver historial ({backups.length} backups)
            </summary>
            <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
              {backups.map((b) => (
                <div key={b.nombre} className="flex justify-between text-xs text-slate-500 px-1">
                  <span>{b.nombre}</span>
                  <span>{(b.tamaño / 1024).toFixed(0)} KB — {new Date(b.fecha).toLocaleString('es-AR')}</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* Actualizaciones */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col gap-4">
        <h2 className="font-semibold text-slate-700">Actualizaciones</h2>
        <UpdaterPanel updater={updater} onCheck={handleCheckUpdate} onDescargar={handleDescargar} onInstalar={handleInstalar} />
      </div>

      {/* Sistema */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-700 mb-3">Información del sistema</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <InfoRow label="Versión" value="2.0.0" />
          <InfoRow label="Base de datos" value="SQLite + WAL mode" />
          <InfoRow label="PIN por defecto" value="1234 (cambiarlo en Usuarios)" />
        </div>
      </div>
    </div>
  )
}

function UpdaterPanel({ updater, onCheck, onDescargar, onInstalar }: {
  updater: UpdaterInfo
  onCheck: () => void
  onDescargar: () => void
  onInstalar: () => void
}): JSX.Element {
  const { estado, version, progreso, velocidad, mensaje } = updater
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
          estado === 'up_to_date' ? 'bg-green-500' :
          estado === 'available' || estado === 'ready' ? 'bg-blue-500' :
          estado === 'downloading' ? 'bg-yellow-400' :
          estado === 'error' ? 'bg-red-500' : 'bg-slate-300'
        }`} />
        <span className="text-sm text-slate-700">
          {estado === 'idle' && 'Sin verificar'}
          {estado === 'checking' && 'Verificando...'}
          {estado === 'up_to_date' && 'La aplicación está actualizada'}
          {estado === 'available' && `Nueva versión disponible: v${version}`}
          {estado === 'downloading' && `Descargando v${version}... ${progreso ?? 0}% (${velocidad ?? 0} KB/s)`}
          {estado === 'ready' && `v${version} lista para instalar`}
          {estado === 'error' && `Error: ${mensaje}`}
        </span>
      </div>
      {estado === 'downloading' && (
        <div className="w-full bg-slate-100 rounded-full h-2">
          <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${progreso ?? 0}%` }} />
        </div>
      )}
      <div className="flex gap-2">
        {(estado === 'idle' || estado === 'up_to_date' || estado === 'error') && (
          <Button variant="outline" onClick={onCheck} size="sm">Buscar actualizaciones</Button>
        )}
        {estado === 'available' && (
          <Button onClick={onDescargar} size="sm">Descargar</Button>
        )}
        {estado === 'ready' && (
          <Button onClick={onInstalar} size="sm">Reiniciar e instalar</Button>
        )}
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
