import { useState, useEffect, useCallback } from 'react'
import { invoke } from '../lib/api'
import { formatPrecio } from '../lib/format'
import type { Promocion, TipoPromocion, Producto, Categoria } from '../../../shared/types'

const TIPOS_PROMO: { value: TipoPromocion; label: string }[] = [
  { value: 'porcentaje_producto',    label: 'Porcentaje por Producto' },
  { value: 'porcentaje_categoria',   label: 'Porcentaje por Categoría' },
  { value: 'porcentaje_medio_pago',  label: 'Porcentaje por Medio de Pago' },
  { value: '2x1',                    label: '2x1 (lleva 2, paga 1)' },
  { value: '3x2',                    label: '3x2 (lleva 3, paga 2)' },
  { value: 'monto_fijo',             label: 'Monto Fijo' },
]

const MEDIOS_PAGO_OPTS = [
  { value: 'efectivo',        label: 'Efectivo' },
  { value: 'debito',          label: 'Débito' },
  { value: 'credito',         label: 'Crédito' },
  { value: 'transferencia',   label: 'Transferencia' },
  { value: 'qr_mp',           label: 'QR MercadoPago' },
  { value: 'cuenta_corriente', label: 'Cuenta Corriente' },
]

const NEGOCIO_ID_DEFAULT = 1

interface FormState {
  nombre: string
  tipo: TipoPromocion
  valor: string
  productoId: string
  categoriaId: string
  medioPago: string
  vigenciaDesde: string
  vigenciaHasta: string
  activa: boolean
}

const FORM_VACIO: FormState = {
  nombre: '',
  tipo: 'porcentaje_producto',
  valor: '0',
  productoId: '',
  categoriaId: '',
  medioPago: 'efectivo',
  vigenciaDesde: '',
  vigenciaHasta: '',
  activa: true,
}

function tipoRequiereValor(tipo: TipoPromocion): boolean {
  return tipo !== '2x1' && tipo !== '3x2'
}

function tipoAlcance(tipo: TipoPromocion): 'producto' | 'categoria' | 'medio_pago' | 'global' {
  if (tipo === 'porcentaje_producto' || tipo === '2x1' || tipo === '3x2') return 'producto'
  if (tipo === 'porcentaje_categoria') return 'categoria'
  if (tipo === 'porcentaje_medio_pago') return 'medio_pago'
  return 'global' // monto_fijo
}

function formatAlcance(p: Promocion, productos: Producto[], categorias: Categoria[]): string {
  if (p.productoId) {
    const prod = productos.find((pr) => pr.id === p.productoId)
    return prod ? prod.nombre : `Producto #${p.productoId}`
  }
  if (p.categoriaId) {
    const cat = categorias.find((c) => c.id === p.categoriaId)
    return cat ? cat.nombre : `Categoría #${p.categoriaId}`
  }
  if (p.medioPago) {
    return MEDIOS_PAGO_OPTS.find((m) => m.value === p.medioPago)?.label ?? p.medioPago
  }
  return 'Global'
}

function formatTipo(tipo: TipoPromocion): string {
  return TIPOS_PROMO.find((t) => t.value === tipo)?.label ?? tipo
}

function formatVigencia(desde: string | null, hasta: string | null): string {
  if (!desde && !hasta) return 'Sin límite'
  if (desde && hasta) return `${desde} → ${hasta}`
  if (desde) return `Desde ${desde}`
  return `Hasta ${hasta}`
}

export function PromocionesPage(): JSX.Element {
  const [promociones, setPromociones] = useState<Promocion[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [form, setForm] = useState<FormState>(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)

  const cargarDatos = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const [promos, prods, cats] = await Promise.all([
        invoke('promociones:list', {}),
        invoke('productos:list', { limit: 500 }),
        invoke('categorias:list', {}),
      ])
      setPromociones(promos)
      setProductos(prods.items)
      setCategorias(cats)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargarDatos()
  }, [cargarDatos])

  const handleNuevo = useCallback(() => {
    setEditandoId(null)
    setForm(FORM_VACIO)
    setMostrarFormulario(true)
  }, [])

  const handleEditar = useCallback((p: Promocion) => {
    setEditandoId(p.id)
    setForm({
      nombre: p.nombre,
      tipo: p.tipo,
      valor: String(p.valor),
      productoId: p.productoId !== null ? String(p.productoId) : '',
      categoriaId: p.categoriaId !== null ? String(p.categoriaId) : '',
      medioPago: p.medioPago ?? 'efectivo',
      vigenciaDesde: p.vigenciaDesde ?? '',
      vigenciaHasta: p.vigenciaHasta ?? '',
      activa: p.activa,
    })
    setMostrarFormulario(true)
  }, [])

  const handleCancelar = useCallback(() => {
    setMostrarFormulario(false)
    setEditandoId(null)
    setForm(FORM_VACIO)
  }, [])

  const handleGuardar = useCallback(async () => {
    if (!form.nombre.trim()) { alert('El nombre es obligatorio'); return }

    setGuardando(true)
    try {
      const alcance = tipoAlcance(form.tipo)
      const payload = {
        negocioId: NEGOCIO_ID_DEFAULT,
        nombre: form.nombre.trim(),
        tipo: form.tipo,
        valor: tipoRequiereValor(form.tipo) ? Number(form.valor) : 0,
        productoId: alcance === 'producto' && form.productoId ? Number(form.productoId) : null,
        categoriaId: alcance === 'categoria' && form.categoriaId ? Number(form.categoriaId) : null,
        medioPago: alcance === 'medio_pago' ? form.medioPago : null,
        vigenciaDesde: form.vigenciaDesde || null,
        vigenciaHasta: form.vigenciaHasta || null,
        activa: form.activa,
      }

      if (editandoId !== null) {
        await invoke('promociones:update', { id: editandoId, ...payload })
      } else {
        await invoke('promociones:create', payload)
      }

      await cargarDatos()
      handleCancelar()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }, [form, editandoId, cargarDatos, handleCancelar])

  const handleEliminar = useCallback(async (id: number) => {
    if (!window.confirm('¿Eliminar esta promoción?')) return
    try {
      await invoke('promociones:delete', { id })
      await cargarDatos()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar')
    }
  }, [cargarDatos])

  const handleToggleActiva = useCallback(async (p: Promocion) => {
    try {
      await invoke('promociones:update', { id: p.id, activa: !p.activa })
      await cargarDatos()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al actualizar')
    }
  }, [cargarDatos])

  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  const alcance = tipoAlcance(form.tipo)

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        <p>Cargando promociones...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-red-500">
        <p className="font-semibold">{error}</p>
        <button onClick={() => void cargarDatos()} className="mt-3 text-blue-500 underline text-sm">
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Promociones y Descuentos</h1>
          <p className="text-sm text-slate-500 mt-0.5">{promociones.length} promoción{promociones.length !== 1 ? 'es' : ''} registrada{promociones.length !== 1 ? 's' : ''}</p>
        </div>
        {!mostrarFormulario && (
          <button
            onClick={handleNuevo}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            + Nueva promoción
          </button>
        )}
      </div>

      {/* Formulario inline */}
      {mostrarFormulario && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            {editandoId !== null ? 'Editar promoción' : 'Nueva promoción'}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {/* Nombre */}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Nombre *</label>
              <input
                type="text"
                value={form.nombre}
                onChange={(e) => setField('nombre', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                placeholder="Ej: 20% off productos electrónicos"
              />
            </div>

            {/* Tipo */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
              <select
                value={form.tipo}
                onChange={(e) => setField('tipo', e.target.value as TipoPromocion)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
              >
                {TIPOS_PROMO.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Valor */}
            {tipoRequiereValor(form.tipo) && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {form.tipo === 'monto_fijo' ? 'Monto fijo ($)' : 'Porcentaje (%)'}
                </label>
                <input
                  type="number"
                  min={0}
                  step={form.tipo === 'monto_fijo' ? 1 : 0.1}
                  value={form.valor}
                  onChange={(e) => setField('valor', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                />
              </div>
            )}

            {/* Alcance: Producto */}
            {alcance === 'producto' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Producto</label>
                <select
                  value={form.productoId}
                  onChange={(e) => setField('productoId', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                >
                  <option value="">-- Seleccionar --</option>
                  {productos.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Alcance: Categoría */}
            {alcance === 'categoria' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Categoría</label>
                <select
                  value={form.categoriaId}
                  onChange={(e) => setField('categoriaId', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                >
                  <option value="">-- Seleccionar --</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Alcance: Medio de pago */}
            {alcance === 'medio_pago' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Medio de pago</label>
                <select
                  value={form.medioPago}
                  onChange={(e) => setField('medioPago', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                >
                  {MEDIOS_PAGO_OPTS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Vigencia */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Vigencia desde</label>
              <input
                type="date"
                value={form.vigenciaDesde}
                onChange={(e) => setField('vigenciaDesde', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Vigencia hasta</label>
              <input
                type="date"
                value={form.vigenciaHasta}
                onChange={(e) => setField('vigenciaHasta', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
            </div>

            {/* Activa */}
            <div className="flex items-center gap-2 col-span-2">
              <input
                id="promo-activa"
                type="checkbox"
                checked={form.activa}
                onChange={(e) => setField('activa', e.target.checked)}
                className="w-4 h-4 accent-blue-600"
              />
              <label htmlFor="promo-activa" className="text-sm text-slate-700">Activa</label>
            </div>
          </div>

          <div className="flex gap-3 mt-5">
            <button
              onClick={() => void handleGuardar()}
              disabled={guardando}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg transition-colors text-sm"
            >
              {guardando ? 'Guardando...' : editandoId !== null ? 'Guardar cambios' : 'Crear promoción'}
            </button>
            <button
              onClick={handleCancelar}
              className="border border-slate-200 text-slate-600 hover:bg-slate-50 px-5 py-2 rounded-lg transition-colors text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="flex-1 overflow-auto">
        {promociones.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-300">
            <span className="text-5xl mb-3">🏷️</span>
            <p className="text-slate-500 font-medium">No hay promociones creadas</p>
            <p className="text-slate-400 text-sm mt-1">Creá una nueva para empezar</p>
          </div>
        ) : (
          <table className="w-full bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nombre</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Valor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Alcance</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Vigencia</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {promociones.map((p, idx) => (
                <tr
                  key={p.id}
                  className={`border-b border-slate-100 last:border-0 ${idx % 2 === 0 ? '' : 'bg-slate-50/50'}`}
                >
                  <td className="px-4 py-3 text-sm font-medium text-slate-800">{p.nombre}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{formatTipo(p.tipo)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {p.tipo === '2x1' || p.tipo === '3x2'
                      ? p.tipo.toUpperCase()
                      : p.tipo === 'monto_fijo'
                      ? formatPrecio(p.valor)
                      : `${p.valor}%`}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {formatAlcance(p, productos, categorias)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {formatVigencia(p.vigenciaDesde, p.vigenciaHasta)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => void handleToggleActiva(p)}
                      className={`text-xs font-semibold px-2 py-1 rounded-full transition-colors ${
                        p.activa
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {p.activa ? 'Activa' : 'Inactiva'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEditar(p)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => void handleEliminar(p.id)}
                        className="text-xs text-red-400 hover:text-red-600 font-medium"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
