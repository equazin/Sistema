import { useEffect, useState, useCallback } from 'react'
import { invoke } from '../lib/api'
import { Button } from '../components/ui/Button'
import { formatCurrency } from '../lib/format'
import type { TransferenciaStock, Sucursal, Producto } from '../../../shared/types'
import { useAuthStore } from '../stores/auth.store'

export function TransferenciasPage(): JSX.Element {
  const usuario = useAuthStore((s) => s.usuario)
  const [transferencias, setTransferencias] = useState<TransferenciaStock[]>([])
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    origenId: '',
    destinoId: '',
    observacion: '',
    items: [{ productoId: '', cantidad: '' }],
  })

  const cargar = useCallback(async () => {
    const [ts, ss, ps] = await Promise.all([
      invoke('transferencias:list', {}),
      invoke('sucursales:list', {}),
      invoke('productos:list', { limit: 1000 }).then(r => r.items),
    ])
    setTransferencias(ts)
    setSucursales(ss)
    setProductos(ps)
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const handleAgregarItem = useCallback(() => {
    setForm((f) => ({ ...f, items: [...f.items, { productoId: '', cantidad: '' }] }))
  }, [])

  const handleRemoverItem = useCallback((idx: number) => {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))
  }, [])

  const handleCrear = useCallback(async () => {
    if (!form.origenId || !form.destinoId) { setError('Seleccionar origen y destino'); return }
    if (form.origenId === form.destinoId) { setError('Origen y destino no pueden ser iguales'); return }
    const items = form.items.filter(i => i.productoId && Number(i.cantidad) > 0)
    if (items.length === 0) { setError('Agregar al menos un producto con cantidad'); return }

    setCreando(true); setError(null)
    try {
      await invoke('transferencias:crear', {
        sucursalOrigenId: Number(form.origenId),
        sucursalDestinoId: Number(form.destinoId),
        usuarioId: usuario!.id,
        observacion: form.observacion || undefined,
        items: items.map(i => ({ productoId: Number(i.productoId), cantidad: Number(i.cantidad) })),
      })
      setForm({ origenId: '', destinoId: '', observacion: '', items: [{ productoId: '', cantidad: '' }] })
      await cargar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear')
    } finally {
      setCreando(false)
    }
  }, [form, usuario, cargar])

  const handleRecibir = useCallback(async (id: number) => {
    try {
      await invoke('transferencias:recibir', { id, usuarioId: usuario!.id })
      await cargar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al recibir')
    }
  }, [usuario, cargar])

  const handleCancelar = useCallback(async (id: number) => {
    if (!confirm('¿Cancelar esta transferencia?')) return
    try {
      await invoke('transferencias:cancelar', { id, usuarioId: usuario!.id })
      await cargar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cancelar')
    }
  }, [usuario, cargar])

  if (loading) return <div className="flex items-center justify-center h-full text-slate-400">Cargando...</div>

  const estadoColor = (estado: string) => ({
    pendiente: 'bg-amber-100 text-amber-700',
    en_transito: 'bg-blue-100 text-blue-700',
    recibida: 'bg-green-100 text-green-700',
    cancelada: 'bg-slate-100 text-slate-500',
  }[estado] ?? 'bg-slate-100 text-slate-500')

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Transferencias de stock</h1>

      {/* Nueva transferencia */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col gap-4">
        <h2 className="font-semibold text-slate-700">Nueva transferencia</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Sucursal origen</label>
            <select value={form.origenId} onChange={(e) => setForm((f) => ({ ...f, origenId: e.target.value }))}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500">
              <option value="">Seleccionar...</option>
              {sucursales.filter(s => s.activa).map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Sucursal destino</label>
            <select value={form.destinoId} onChange={(e) => setForm((f) => ({ ...f, destinoId: e.target.value }))}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500">
              <option value="">Seleccionar...</option>
              {sucursales.filter(s => s.activa && String(s.id) !== form.origenId).map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">Observación (opcional)</label>
          <input value={form.observacion} onChange={(e) => setForm((f) => ({ ...f, observacion: e.target.value }))}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
            placeholder="Motivo de la transferencia..." />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-slate-700">Productos</p>
          {form.items.map((item, idx) => (
            <div key={idx} className="flex gap-2">
              <select value={item.productoId} onChange={(e) => setForm((f) => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, productoId: e.target.value } : it) }))}
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500">
                <option value="">Seleccionar producto...</option>
                {productos.map(p => <option key={p.id} value={p.id}>{p.nombre} (stock: {p.stockActual})</option>)}
              </select>
              <input type="number" min={1} value={item.cantidad} onChange={(e) => setForm((f) => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, cantidad: e.target.value } : it) }))}
                className="w-24 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                placeholder="Cant." />
              {form.items.length > 1 && (
                <button onClick={() => handleRemoverItem(idx)} className="text-slate-400 hover:text-red-500 px-2">✕</button>
              )}
            </div>
          ))}
          <button onClick={handleAgregarItem} className="text-sm text-blue-600 hover:underline text-left">+ Agregar producto</button>
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="pt-2 border-t border-slate-100">
          <Button onClick={handleCrear} disabled={creando}>{creando ? 'Creando...' : 'Crear transferencia'}</Button>
        </div>
      </div>

      {/* Historial */}
      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
        <div className="p-4 font-semibold text-slate-700">Historial</div>
        {transferencias.length === 0 ? (
          <p className="text-slate-400 text-sm p-4">Sin transferencias registradas.</p>
        ) : transferencias.map((t) => (
          <div key={t.id} className="p-4 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${estadoColor(t.estado)}`}>{t.estado}</span>
                <span className="text-sm font-medium text-slate-700 truncate">{t.nombreOrigen} → {t.nombreDestino}</span>
              </div>
              {t.observacion && <p className="text-xs text-slate-500 mt-0.5">{t.observacion}</p>}
              <p className="text-xs text-slate-400 mt-0.5">{new Date(t.fecha).toLocaleString('es-AR')}</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {(t.estado === 'pendiente' || t.estado === 'en_transito') && (
                <>
                  <Button variant="outline" size="sm" onClick={() => handleRecibir(t.id)}>Recibir</Button>
                  <Button variant="outline" size="sm" onClick={() => handleCancelar(t.id)}>Cancelar</Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
