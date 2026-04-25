import { useEffect, useState, useCallback } from 'react'
import { invoke } from '../lib/api'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import type { ImpresionConfig, ImpresoraSistema, Negocio, TicketAncho } from '../../../shared/types'
import { MODULOS, type ModuloKey, type PlanTipo } from '../../../shared/modules'

type MpFormData = { accessToken: string; posId: string; sucursalId: string }
type BackupConfig = { carpeta: string; frecuencia: 'diario' | 'semanal' | 'manual' }
type ApiConfig = { enabled: boolean; port: number; apiKeyPreview: string; bindLocalhostOnly: boolean; running: boolean }
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

  const [impresionConfig, setImpresionConfig] = useState<ImpresionConfig>({ anchoTicket: '80mm', printerName: '' })
  const [impresoras, setImpresoras] = useState<ImpresoraSistema[]>([])
  const [isSavingImpresion, setIsSavingImpresion] = useState(false)
  const [savedImpresion, setSavedImpresion] = useState(false)

  const [backupConfig, setBackupConfig] = useState<BackupConfig>({ carpeta: '', frecuencia: 'diario' })
  const [backupLoading, setBackupLoading] = useState(false)
  const [backupMensaje, setBackupMensaje] = useState<string | null>(null)
  const [backups, setBackups] = useState<{ nombre: string; fecha: string; tamaño: number }[]>([])

  const [updater, setUpdater] = useState<UpdaterInfo>({ estado: 'idle' })

  const [apiConfig, setApiConfig] = useState<ApiConfig>({ enabled: false, port: 3001, apiKeyPreview: '', bindLocalhostOnly: false, running: false })
  const [apiSaving, setApiSaving] = useState(false)
  const [apiRawKey, setApiRawKey] = useState<string | null>(null)
  const [apiMsg, setApiMsg] = useState<string | null>(null)

  const [plan, setPlan] = useState<PlanTipo>('free')
  const [modulos, setModulos] = useState<Record<ModuloKey, boolean>>({} as Record<ModuloKey, boolean>)

  const [gdriveConfigured, setGdriveConfigured] = useState(false)
  const [gdriveForm, setGdriveForm] = useState({ clientId: '', clientSecret: '', folderId: '' })
  const [gdriveCode, setGdriveCode] = useState('')
  const [gdriveMsg, setGdriveMsg] = useState<string | null>(null)
  const [gdriveUploading, setGdriveUploading] = useState(false)

  useEffect(() => {
    invoke('negocio:get', {}).then((n) => { if (n) setForm(toForm(n)); setIsLoading(false) })
    invoke('config:mp:get', {}).then((mp) => { if (mp) setMpForm(mp) }).catch(() => {})
    invoke('config:impresion:get', {}).then(setImpresionConfig).catch(() => {})
    invoke('config:impresion:listPrinters', {}).then(setImpresoras).catch(() => {})
    invoke('backup:getConfig', {}).then((cfg) => { if (cfg) setBackupConfig(cfg) }).catch(() => {})
    invoke('backup:listar', {}).then(setBackups).catch(() => {})
    invoke('api:getConfig', {}).then(setApiConfig).catch(() => {})
    invoke('gdrive:getConfig', {}).then(({ configured }) => setGdriveConfigured(configured)).catch(() => {})
    invoke('plan:get', {}).then(({ plan: p, modulos: m }) => {
      setPlan(p as PlanTipo)
      setModulos(m as Record<ModuloKey, boolean>)
    }).catch(() => {})

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

  const setImpresion = useCallback(<K extends keyof ImpresionConfig>(key: K, value: ImpresionConfig[K]) => {
    setImpresionConfig((prev) => ({ ...prev, [key]: value }))
    setSavedImpresion(false)
  }, [])

  const handleSaveImpresion = useCallback(async () => {
    setIsSavingImpresion(true)
    try {
      await invoke('config:impresion:set', impresionConfig)
      setSavedImpresion(true)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al guardar impresión')
    } finally {
      setIsSavingImpresion(false)
    }
  }, [impresionConfig])

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

  const handleApiToggle = useCallback(async (enabled: boolean) => {
    setApiSaving(true); setApiMsg(null)
    try {
      await invoke('api:setConfig', { enabled, port: apiConfig.port, bindLocalhostOnly: apiConfig.bindLocalhostOnly })
      const fresh = await invoke('api:getConfig', {})
      setApiConfig(fresh)
      setApiMsg(enabled ? '✓ API iniciada' : '✓ API detenida')
    } catch (err) {
      setApiMsg(`Error: ${err instanceof Error ? err.message : 'Error desconocido'}`)
    } finally {
      setApiSaving(false)
    }
  }, [apiConfig])

  const handleApiSavePort = useCallback(async () => {
    setApiSaving(true); setApiMsg(null)
    try {
      await invoke('api:setConfig', { enabled: apiConfig.enabled, port: apiConfig.port, bindLocalhostOnly: apiConfig.bindLocalhostOnly })
      const fresh = await invoke('api:getConfig', {})
      setApiConfig(fresh)
      setApiMsg('✓ Guardado')
    } catch (err) {
      setApiMsg(`Error: ${err instanceof Error ? err.message : 'Error desconocido'}`)
    } finally {
      setApiSaving(false)
    }
  }, [apiConfig])

  const handleRotateKey = useCallback(async () => {
    if (!confirm('¿Generar nueva API key? La clave anterior dejará de funcionar.')) return
    setApiMsg(null)
    try {
      const { rawKey, preview } = await invoke('api:rotateKey', {})
      setApiRawKey(rawKey)
      setApiConfig((c) => ({ ...c, apiKeyPreview: preview }))
    } catch (err) {
      setApiMsg(`Error: ${err instanceof Error ? err.message : 'Error desconocido'}`)
    }
  }, [])

  const handlePlanChange = useCallback(async (newPlan: PlanTipo) => {
    try {
      await invoke('plan:set', { plan: newPlan })
      const { plan: p, modulos: m } = await invoke('plan:get', {})
      setPlan(p as PlanTipo)
      setModulos(m as Record<ModuloKey, boolean>)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al cambiar plan')
    }
  }, [])

  const handleModuloToggle = useCallback(async (key: ModuloKey, enabled: boolean) => {
    const newOverrides = { ...modulos, [key]: enabled }
    try {
      await invoke('plan:set', { plan, overrides: newOverrides })
      const { modulos: m } = await invoke('plan:get', {})
      setModulos(m as Record<ModuloKey, boolean>)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al cambiar módulo')
    }
  }, [plan, modulos])

  const handleGdriveSaveCredentials = useCallback(async () => {
    setGdriveMsg(null)
    try {
      await invoke('gdrive:setCredentials', gdriveForm)
      setGdriveMsg('✓ Credenciales guardadas')
    } catch (err) {
      setGdriveMsg(`Error: ${err instanceof Error ? err.message : 'Error desconocido'}`)
    }
  }, [gdriveForm])

  const handleGdriveAuth = useCallback(async () => {
    setGdriveMsg(null)
    try {
      await invoke('gdrive:getAuthUrl', { clientId: gdriveForm.clientId, clientSecret: gdriveForm.clientSecret })
      setGdriveMsg('Se abrió el navegador. Pegá el código de autorización abajo.')
    } catch (err) {
      setGdriveMsg(`Error: ${err instanceof Error ? err.message : 'Error desconocido'}`)
    }
  }, [gdriveForm])

  const handleGdriveExchangeCode = useCallback(async () => {
    setGdriveMsg(null)
    try {
      await invoke('gdrive:exchangeCode', { code: gdriveCode.trim() })
      setGdriveConfigured(true)
      setGdriveCode('')
      setGdriveMsg('✓ Autorizado correctamente')
    } catch (err) {
      setGdriveMsg(`Error: ${err instanceof Error ? err.message : 'Error desconocido'}`)
    }
  }, [gdriveCode])

  const handleGdriveBackup = useCallback(async () => {
    setGdriveUploading(true); setGdriveMsg(null)
    try {
      const result = await invoke('gdrive:backupAndUpload', {})
      setGdriveMsg(result.uploaded ? `✓ Backup subido: ${result.path.split(/[\\/]/).pop()}` : `✓ Backup local creado (no subido)`)
    } catch (err) {
      setGdriveMsg(`Error: ${err instanceof Error ? err.message : 'Error desconocido'}`)
    } finally {
      setGdriveUploading(false)
    }
  }, [])

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

      {/* Impresion */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col gap-5">
        <div>
          <h2 className="font-semibold text-slate-700 mb-1">Impresión de tickets</h2>
          <p className="text-xs text-slate-500">Formato usado para la vista previa y la impresión de venta/cierre.</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Ancho de ticket</label>
            <select
              value={impresionConfig.anchoTicket}
              onChange={(e) => setImpresion('anchoTicket', e.target.value as TicketAncho)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              <option value="80mm">80mm</option>
              <option value="58mm">58mm</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Impresora preferida</label>
            <select
              value={impresionConfig.printerName}
              onChange={(e) => setImpresion('printerName', e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              <option value="">Elegir al imprimir</option>
              {impresoras.map((impresora) => (
                <option key={impresora.name} value={impresora.name}>
                  {impresora.displayName}{impresora.isDefault ? ' (predeterminada)' : ''}
                </option>
              ))}
              {impresionConfig.printerName && !impresoras.some((i) => i.name === impresionConfig.printerName) && (
                <option value={impresionConfig.printerName}>{impresionConfig.printerName}</option>
              )}
            </select>
            {impresoras.length === 0 && (
              <p className="text-xs text-slate-500">No se detectaron impresoras instaladas.</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 pt-2 border-t border-slate-100">
          <Button onClick={handleSaveImpresion} disabled={isSavingImpresion}>
            {isSavingImpresion ? 'Guardando...' : 'Guardar impresión'}
          </Button>
          {savedImpresion && <span className="text-green-600 text-sm font-medium">✓ Guardado</span>}
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

      {/* API Local */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col gap-5">
        <div>
          <h2 className="font-semibold text-slate-700 mb-1">API Local</h2>
          <p className="text-xs text-slate-500">Servidor REST para integración con app mobile u otros sistemas en la red local.</p>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${apiConfig.running ? 'bg-green-500' : 'bg-slate-300'}`} />
            <span className="text-sm text-slate-700">{apiConfig.running ? `Activa en puerto ${apiConfig.port}` : 'Inactiva'}</span>
          </div>
          <Button
            variant={apiConfig.enabled ? 'outline' : 'primary'}
            size="sm"
            disabled={apiSaving}
            onClick={() => handleApiToggle(!apiConfig.enabled)}
          >
            {apiSaving ? '...' : apiConfig.enabled ? 'Detener' : 'Iniciar'}
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Puerto</label>
            <input
              type="number" min={1024} max={65535}
              value={apiConfig.port}
              onChange={(e) => setApiConfig((c) => ({ ...c, port: parseInt(e.target.value) || 3001 }))}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Acceso</label>
            <select
              value={apiConfig.bindLocalhostOnly ? 'local' : 'lan'}
              onChange={(e) => setApiConfig((c) => ({ ...c, bindLocalhostOnly: e.target.value === 'local' }))}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              <option value="lan">Red local (LAN)</option>
              <option value="local">Solo localhost</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
          <div className="flex-1">
            <p className="text-xs text-slate-500 mb-0.5">API Key</p>
            <p className="text-sm font-mono text-slate-700">
              {apiConfig.apiKeyPreview ? `${apiConfig.apiKeyPreview}••••••••` : 'Sin clave generada'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRotateKey}>Rotar clave</Button>
        </div>
        {apiRawKey && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs font-medium text-amber-700 mb-1">Copia esta clave ahora — no se mostrará de nuevo</p>
            <p className="font-mono text-sm text-amber-900 break-all select-all">{apiRawKey}</p>
            <button className="text-xs text-amber-600 mt-1 underline" onClick={() => setApiRawKey(null)}>Ocultar</button>
          </div>
        )}
        {apiMsg && (
          <p className={`text-sm font-medium ${apiMsg.startsWith('Error') ? 'text-red-500' : 'text-green-600'}`}>{apiMsg}</p>
        )}
        <div className="pt-2 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={handleApiSavePort} disabled={apiSaving}>Guardar puerto y acceso</Button>
        </div>
      </div>

      {/* Google Drive backup */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col gap-5">
        <div>
          <h2 className="font-semibold text-slate-700 mb-1">Backup en Google Drive</h2>
          <p className="text-xs text-slate-500">Sube backups automáticamente a tu Google Drive. Requiere una app OAuth2 en Google Cloud Console.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${gdriveConfigured ? 'bg-green-500' : 'bg-slate-300'}`} />
          <span className="text-sm text-slate-600">{gdriveConfigured ? 'Autorizado' : 'Sin autorizar'}</span>
        </div>
        <div className="flex flex-col gap-3">
          <Input label="Client ID" value={gdriveForm.clientId} onChange={(e) => setGdriveForm((f) => ({ ...f, clientId: e.target.value }))} placeholder="xxxx.apps.googleusercontent.com" />
          <Input label="Client Secret" value={gdriveForm.clientSecret} onChange={(e) => setGdriveForm((f) => ({ ...f, clientSecret: e.target.value }))} type="password" placeholder="GOCSPX-..." />
          <Input label="ID de carpeta en Drive (opcional)" value={gdriveForm.folderId} onChange={(e) => setGdriveForm((f) => ({ ...f, folderId: e.target.value }))} placeholder="1BxiMVs0XRA..." />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleGdriveSaveCredentials}>Guardar credenciales</Button>
          <Button variant="outline" size="sm" onClick={handleGdriveAuth}>Autorizar con Google</Button>
        </div>
        {gdriveMsg?.includes('código') && (
          <div className="flex gap-2">
            <input
              value={gdriveCode}
              onChange={(e) => setGdriveCode(e.target.value)}
              placeholder="Pega aquí el código de autorización"
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
            <Button size="sm" onClick={handleGdriveExchangeCode}>Confirmar</Button>
          </div>
        )}
        {gdriveMsg && (
          <p className={`text-sm font-medium ${gdriveMsg.startsWith('Error') ? 'text-red-500' : 'text-green-600'}`}>{gdriveMsg}</p>
        )}
        {gdriveConfigured && (
          <div className="pt-2 border-t border-slate-100">
            <Button onClick={handleGdriveBackup} disabled={gdriveUploading} size="sm">
              {gdriveUploading ? 'Subiendo...' : 'Hacer backup y subir a Drive'}
            </Button>
          </div>
        )}
      </div>

      {/* Plan y módulos */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col gap-5">
        <div>
          <h2 className="font-semibold text-slate-700 mb-1">Plan y módulos</h2>
          <p className="text-xs text-slate-500">Habilita o deshabilita funcionalidades según el plan contratado.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-700">Plan activo</label>
          <select
            value={plan}
            onChange={(e) => handlePlanChange(e.target.value as PlanTipo)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-500"
          >
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
        <div className="space-y-2">
          {(Object.entries(MODULOS) as [ModuloKey, typeof MODULOS[ModuloKey]][]).map(([key, meta]) => (
            <div key={key} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50">
              <div>
                <p className="text-sm font-medium text-slate-700">{meta.label}</p>
                <p className="text-xs text-slate-500">{meta.descripcion}</p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={modulos[key] ?? false}
                  onChange={(e) => handleModuloToggle(key, e.target.checked)}
                  className="w-4 h-4 accent-blue-600"
                />
                <span className="text-xs text-slate-500">{modulos[key] ? 'On' : 'Off'}</span>
              </label>
            </div>
          ))}
        </div>
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
