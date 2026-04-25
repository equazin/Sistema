import { useState, useRef, useCallback, useEffect } from 'react'
import { invoke } from '../lib/api'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { formatPrecio } from '../lib/format'
import { useAuthStore } from '../stores/auth.store'
import type { PreviewPrecio, ActualizacionMasiva, Categoria } from '../../../shared/types'

// ─── types ───────────────────────────────────────────────────────────────────

type ModoActualizacion = 'porcentaje' | 'csv'
type TipoRedondeo = 'ninguno' | 'entero' | 'decena' | 'centena'
type Paso = 'configurar' | 'preview'

interface CsvItem {
  codigoBarras: string
  precioVenta: number
}

interface FormState {
  modo: ModoActualizacion
  porcentaje: string
  redondear: TipoRedondeo
  soloCategoria: number | null
  soloActivos: boolean
  csvTexto: string
}

const FORM_INICIAL: FormState = {
  modo: 'porcentaje',
  porcentaje: '',
  redondear: 'ninguno',
  soloCategoria: null,
  soloActivos: true,
  csvTexto: '',
}

// ─── component ───────────────────────────────────────────────────────────────

export function PreciosMasivoPage(): JSX.Element {
  const { usuario } = useAuthStore()

  const [paso, setPaso] = useState<Paso>('configurar')
  const [form, setForm] = useState<FormState>(FORM_INICIAL)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [csvErrores, setCsvErrores] = useState<string[]>([])
  const [csvItems, setCsvItems] = useState<CsvItem[]>([])
  const [previews, setPreviews] = useState<PreviewPrecio[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    invoke('categorias:list', {})
      .then(setCategorias)
      .catch(() => {/* categorías opcionales, no bloquear */})
  }, [])

  // ── form setters ────────────────────────────────────────────────────────────

  const setModo = useCallback((modo: ModoActualizacion) => {
    setForm((f) => ({ ...f, modo }))
    setCsvErrores([])
    setCsvItems([])
    setResultado(null)
    setError(null)
  }, [])

  const setSoloCategoria = useCallback((v: number | null) => {
    setForm((f) => ({ ...f, soloCategoria: v }))
  }, [])

  const setCsvTextoValue = useCallback((v: string) => {
    setForm((f) => ({ ...f, csvTexto: v }))
    setCsvErrores([])
    setCsvItems([])
  }, [])

  // ── CSV file loading ────────────────────────────────────────────────────────

  const handleCargarArchivo = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      const contenido = ev.target?.result as string
      setCsvTextoValue(contenido)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
    reader.readAsText(file)
  }, [setCsvTextoValue])

  // ── CSV parse: returns parsed items or null on failure ──────────────────────

  const parsearCSV = useCallback(async (csvTexto: string): Promise<CsvItem[] | null> => {
    if (!csvTexto.trim()) {
      setError('Ingresá o pegá el contenido CSV primero.')
      return null
    }
    try {
      const result = await invoke('precios:parsearCSV', { contenido: csvTexto })
      setCsvErrores(result.errores)
      setCsvItems(result.items)

      if (result.items.length === 0) {
        setError('No se encontraron filas válidas en el CSV.')
        return null
      }
      return result.items
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al parsear CSV')
      return null
    }
  }, [])

  // ── preview ─────────────────────────────────────────────────────────────────

  const handleVerPreview = useCallback(async () => {
    setError(null)
    setResultado(null)

    let req: ActualizacionMasiva

    if (form.modo === 'csv') {
      const items = await parsearCSV(form.csvTexto)
      if (!items) return
      req = { tipo: 'csv', items }
    } else {
      const pct = parseFloat(form.porcentaje)
      if (isNaN(pct)) {
        setError('Ingresá un porcentaje válido.')
        return
      }
      req = {
        tipo: 'porcentaje',
        porcentaje: pct,
        redondear: form.redondear,
        soloCategoria: form.soloCategoria,
        soloActivos: form.soloActivos,
      }
    }

    setCargando(true)
    try {
      const result = await invoke('precios:preview', req)
      if (result.length === 0) {
        setError('No hay productos que coincidan con los criterios seleccionados.')
        return
      }
      setPreviews(result)
      setPaso('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al obtener preview')
    } finally {
      setCargando(false)
    }
  }, [form, parsearCSV])

  // ── aplicar ─────────────────────────────────────────────────────────────────

  const handleConfirmar = useCallback(async () => {
    if (!usuario) return
    if (!confirm(`¿Confirmar la actualización de ${previews.length} precio${previews.length !== 1 ? 's' : ''}?`)) return

    let req: ActualizacionMasiva

    if (form.modo === 'csv') {
      req = { tipo: 'csv', items: csvItems }
    } else {
      const pct = parseFloat(form.porcentaje)
      req = {
        tipo: 'porcentaje',
        porcentaje: pct,
        redondear: form.redondear,
        soloCategoria: form.soloCategoria,
        soloActivos: form.soloActivos,
      }
    }

    const finalReq: ActualizacionMasiva & { usuarioId: number } = {
      ...req,
      usuarioId: usuario.id,
    }

    setCargando(true)
    setError(null)
    try {
      const result = await invoke('precios:aplicar', finalReq)
      setResultado(`${result.actualizados} precio${result.actualizados !== 1 ? 's' : ''} actualizados correctamente.`)
      setPaso('configurar')
      setForm(FORM_INICIAL)
      setCsvItems([])
      setCsvErrores([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al aplicar los cambios')
    } finally {
      setCargando(false)
    }
  }, [usuario, previews.length, form, csvItems])

  const handleVolver = useCallback(() => {
    setPaso('configurar')
    setError(null)
  }, [])

  // ── summary stats ───────────────────────────────────────────────────────────

  const resumen = (() => {
    if (previews.length === 0) return null
    const promPct =
      previews.reduce((acc, p) => acc + p.diferenciaPct, 0) / previews.length
    const signo = promPct >= 0 ? '+' : ''
    return { cantidad: previews.length, promPct: `${signo}${promPct.toFixed(1)}%` }
  })()

  // ─── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full gap-4 max-w-5xl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Actualización masiva de precios</h1>
        <p className="text-sm text-slate-500">
          {paso === 'configurar'
            ? 'Configurá los parámetros y hacé clic en "Ver preview" para revisar los cambios antes de aplicarlos.'
            : 'Revisá los cambios propuestos antes de confirmar.'}
        </p>
      </div>

      {/* Resultado anterior */}
      {resultado && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-800 text-sm font-medium">
          {resultado}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* ── Paso 1: Configurar ─────────────────────────────────────────────── */}
      {paso === 'configurar' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col gap-6">

          {/* Toggle modo */}
          <div className="flex gap-2">
            <button
              onClick={() => setModo('porcentaje')}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                form.modo === 'porcentaje'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
            >
              Por porcentaje
            </button>
            <button
              onClick={() => setModo('csv')}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                form.modo === 'csv'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
            >
              Desde CSV
            </button>
          </div>

          {/* Modo porcentaje */}
          {form.modo === 'porcentaje' && (
            <div className="flex flex-col gap-4">

              <div className="flex flex-wrap gap-4 items-end">
                <div className="w-48">
                  <Input
                    label="Porcentaje de ajuste"
                    type="number"
                    placeholder="Ej: 15 o -5"
                    value={form.porcentaje}
                    onChange={(e) => setForm((f) => ({ ...f, porcentaje: e.target.value }))}
                  />
                  <p className="text-xs text-slate-400 mt-1">Positivo: sube. Negativo: baja.</p>
                </div>

                <div className="flex flex-col gap-1 w-52">
                  <label className="text-sm font-medium text-slate-700">Redondeo</label>
                  <select
                    value={form.redondear}
                    onChange={(e) => setForm((f) => ({ ...f, redondear: e.target.value as TipoRedondeo }))}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="ninguno">Sin redondear</option>
                    <option value="entero">Entero (ej: $123)</option>
                    <option value="decena">Decena (ej: $120)</option>
                    <option value="centena">Centena (ej: $100)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1 w-56">
                  <label className="text-sm font-medium text-slate-700">Categoría</label>
                  <select
                    value={form.soloCategoria ?? ''}
                    onChange={(e) => setSoloCategoria(e.target.value ? Number(e.target.value) : null)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">Todas las categorías</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer w-fit">
                <input
                  type="checkbox"
                  checked={form.soloActivos}
                  onChange={(e) => setForm((f) => ({ ...f, soloActivos: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Solo productos activos
              </label>
            </div>
          )}

          {/* Modo CSV */}
          {form.modo === 'csv' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <p className="text-sm text-slate-600">
                  Formato: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono">codigoBarras,precioVenta</code> (una fila por línea)
                </p>
                <Button variant="outline" size="sm" onClick={handleCargarArchivo}>
                  Cargar archivo
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              <textarea
                value={form.csvTexto}
                onChange={(e) => setCsvTextoValue(e.target.value)}
                placeholder={`codigoBarras,precioVenta\n7790895000016,1250.00\n7790895000023,890.50`}
                rows={10}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-400 resize-y"
              />

              {csvErrores.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                  <p className="text-sm font-medium text-amber-800 mb-1">
                    {csvErrores.length} error{csvErrores.length !== 1 ? 'es' : ''} en el CSV:
                  </p>
                  <ul className="text-xs text-amber-700 space-y-0.5 max-h-32 overflow-y-auto">
                    {csvErrores.map((e, i) => (
                      <li key={i}>• {e}</li>
                    ))}
                  </ul>
                </div>
              )}

              {csvItems.length > 0 && (
                <p className="text-sm text-green-700 font-medium">
                  {csvItems.length} fila{csvItems.length !== 1 ? 's' : ''} válida{csvItems.length !== 1 ? 's' : ''} detectada{csvItems.length !== 1 ? 's' : ''}.
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <Button onClick={handleVerPreview} disabled={cargando} size="lg">
              {cargando ? 'Calculando...' : 'Ver preview'}
            </Button>
          </div>
        </div>
      )}

      {/* ── Paso 2: Preview ────────────────────────────────────────────────── */}
      {paso === 'preview' && (
        <div className="flex flex-col gap-4">

          {/* Resumen */}
          {resumen && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-blue-800 text-sm">
              <span className="font-semibold">{resumen.cantidad}</span> producto{resumen.cantidad !== 1 ? 's' : ''} a actualizar
              {' · '}promedio <span className="font-semibold">{resumen.promPct}</span>
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-auto max-h-[calc(100vh-20rem)]">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Producto</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Código</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Precio actual</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Precio nuevo</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Diferencia</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previews.map((p) => (
                  <tr key={p.productoId} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 text-slate-800 font-medium">{p.nombre}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">
                      {p.codigoBarras ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-600">
                      {formatPrecio(p.precioActual)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-blue-600">
                      {formatPrecio(p.precioNuevo)}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-medium ${p.diferencia >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {p.diferencia >= 0 ? '+' : ''}{formatPrecio(p.diferencia)}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-medium ${p.diferenciaPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {p.diferenciaPct >= 0 ? '+' : ''}{p.diferenciaPct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center">
            <Button variant="outline" onClick={handleVolver} disabled={cargando}>
              Volver
            </Button>
            <Button variant="success" onClick={handleConfirmar} disabled={cargando} size="lg">
              {cargando ? 'Aplicando...' : `Confirmar actualización (${previews.length})`}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
