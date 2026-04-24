import { useEffect, useState, useCallback } from 'react'
import { useProductosStore } from '../stores/productos.store'
import { useAuthStore } from '../stores/auth.store'
import { invoke } from '../lib/api'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { formatPrecio, formatFecha } from '../lib/format'
import type { Producto, MovimientoStock } from '../../../shared/types'

export function StockPage(): JSX.Element {
  const { usuario } = useAuthStore()
  const { productos, fetchProductos } = useProductosStore()
  const [movimientos, setMovimientos] = useState<MovimientoStock[]>([])
  const [ajusteModal, setAjusteModal] = useState<Producto | null>(null)
  const [nuevaCantidad, setNuevaCantidad] = useState('')
  const [motivo, setMotivo] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchStock, setSearchStock] = useState('')

  useEffect(() => {
    fetchProductos()
    loadMovimientos()
  }, [])

  const loadMovimientos = useCallback(async () => {
    try {
      const movs = await invoke('stock:movimientos', { limit: 50 })
      setMovimientos(movs)
    } catch { /* ignore */ }
  }, [])

  const productosConAlerta = productos.filter((p) => p.stockActual <= p.stockMinimo)
  const productosFiltrados = searchStock
    ? productos.filter((p) => p.nombre.toLowerCase().includes(searchStock.toLowerCase()))
    : productos

  const handleAjustar = useCallback(async () => {
    if (!ajusteModal || !usuario) return
    const cant = Number(nuevaCantidad)
    if (isNaN(cant) || cant < 0) { alert('Cantidad inválida'); return }
    if (!motivo.trim()) { alert('Ingresá el motivo del ajuste'); return }
    setIsSubmitting(true)
    try {
      await invoke('stock:ajustar', {
        productoId: ajusteModal.id,
        cantidad: cant,
        motivo: motivo.trim(),
        usuarioId: usuario.id,
      })
      await fetchProductos()
      await loadMovimientos()
      setAjusteModal(null)
      setNuevaCantidad('')
      setMotivo('')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al ajustar')
    } finally {
      setIsSubmitting(false)
    }
  }, [ajusteModal, usuario, nuevaCantidad, motivo, fetchProductos, loadMovimientos])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Control de Stock</h1>
      </div>

      {/* Alertas */}
      {productosConAlerta.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="font-semibold text-red-700 mb-2">
            ⚠️ {productosConAlerta.length} producto{productosConAlerta.length !== 1 ? 's' : ''} con stock bajo
          </p>
          <div className="flex flex-wrap gap-2">
            {productosConAlerta.map((p) => (
              <span key={p.id} className="bg-red-100 text-red-700 px-2 py-1 rounded-lg text-sm">
                {p.nombre} ({p.stockActual} {p.unidadMedida})
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-6">
        {/* Lista de productos */}
        <div className="flex-1">
          <Input
            placeholder="Buscar producto..."
            value={searchStock}
            onChange={(e) => setSearchStock(e.target.value)}
            className="mb-3"
          />
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-slate-600 font-semibold">Producto</th>
                  <th className="text-right px-4 py-3 text-slate-600 font-semibold">Stock</th>
                  <th className="text-right px-4 py-3 text-slate-600 font-semibold">Mínimo</th>
                  <th className="text-right px-4 py-3 text-slate-600 font-semibold">Precio venta</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {productosFiltrados.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{p.nombre}</p>
                      <p className="text-xs text-slate-400">{p.codigoBarras ?? p.codigoInterno ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Badge variant={p.stockActual <= p.stockMinimo ? 'danger' : p.stockActual <= p.stockMinimo * 1.5 ? 'warning' : 'success'}>
                        {p.stockActual} {p.unidadMedida}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500">{p.stockMinimo}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatPrecio(p.precioVenta)}</td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setAjusteModal(p)
                          setNuevaCantidad(String(p.stockActual))
                          setMotivo('')
                        }}
                      >
                        Ajustar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Últimos movimientos */}
        <div className="w-72 flex-shrink-0">
          <h2 className="font-semibold text-slate-700 mb-3">Últimos movimientos</h2>
          <div className="flex flex-col gap-2">
            {movimientos.slice(0, 20).map((m) => (
              <div key={m.id} className="bg-white rounded-lg border border-slate-200 px-3 py-2 text-xs">
                <div className="flex justify-between items-center">
                  <Badge variant={m.tipo === 'entrada' ? 'success' : m.tipo === 'ajuste' ? 'info' : 'danger'}>
                    {m.tipo}
                  </Badge>
                  <span className="text-slate-400">{formatFecha(m.fecha)}</span>
                </div>
                <p className="text-slate-600 mt-1">
                  {m.cantidadAnterior} → {m.cantidadAnterior + (m.tipo === 'salida' ? -m.cantidad : m.cantidad)}
                </p>
                {m.motivo && <p className="text-slate-400 truncate">{m.motivo}</p>}
              </div>
            ))}
            {movimientos.length === 0 && (
              <p className="text-slate-400 text-sm text-center py-8">Sin movimientos</p>
            )}
          </div>
        </div>
      </div>

      {/* Modal ajuste */}
      <Modal
        open={!!ajusteModal}
        onClose={() => setAjusteModal(null)}
        title={`Ajustar stock: ${ajusteModal?.nombre ?? ''}`}
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <div className="bg-slate-50 rounded-lg p-3 text-sm">
            <p className="text-slate-500">Stock actual</p>
            <p className="text-2xl font-bold text-slate-800">
              {ajusteModal?.stockActual} {ajusteModal?.unidadMedida}
            </p>
          </div>
          <Input
            label="Nueva cantidad"
            value={nuevaCantidad}
            onChange={(e) => setNuevaCantidad(e.target.value)}
            inputMode="decimal"
            autoFocus
          />
          <Input
            label="Motivo del ajuste *"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej: Inventario físico, merma, etc."
          />
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setAjusteModal(null)} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleAjustar} disabled={isSubmitting} className="flex-1">
              {isSubmitting ? 'Guardando...' : 'Confirmar ajuste'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
