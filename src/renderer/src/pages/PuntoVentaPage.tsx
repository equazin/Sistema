import { useState, useCallback, useEffect, useRef, KeyboardEvent } from 'react'
import { useVentaStore } from '../stores/venta.store'
import { useProductosStore } from '../stores/productos.store'
import { useCajaStore } from '../stores/caja.store'
import { useAuthStore } from '../stores/auth.store'
import { Button } from '../components/ui/Button'
import { formatPrecio } from '../lib/format'
import { invoke } from '../lib/api'
import type { Producto, MedioPago } from '../../../shared/types'

const MEDIOS_PAGO: { key: MedioPago; label: string; icon: string }[] = [
  { key: 'efectivo', label: 'Efectivo', icon: '💵' },
  { key: 'debito', label: 'Débito', icon: '💳' },
  { key: 'credito', label: 'Crédito', icon: '💳' },
  { key: 'transferencia', label: 'Transferencia', icon: '🏦' },
  { key: 'qr_mp', label: 'QR MP', icon: '📱' },
]

export function PuntoVentaPage(): JSX.Element {
  const { usuario } = useAuthStore()
  const { turnoActual } = useCajaStore()
  const {
    items, pagos, descuentoTotal,
    agregarProducto, quitarItem, actualizarCantidad,
    agregarPago, completarVenta, resetVenta,
    subtotal, total,
    isLoading, ventaCompletada,
  } = useVentaStore()
  const { findByBarcode, fetchProductos, productos } = useProductosStore()

  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<Producto[]>([])
  const [mostrarPago, setMostrarPago] = useState(false)
  const [efectivoIngresado, setEfectivoIngresado] = useState('')
  const [_medioPagoActivo, setMedioPagoActivo] = useState<MedioPago>('efectivo')
  const busquedaRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchProductos()
    busquedaRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!ventaCompletada) return
    const t = setTimeout(() => {
      resetVenta()
      setMostrarPago(false)
      setBusqueda('')
      setEfectivoIngresado('')
      busquedaRef.current?.focus()
    }, 1500)
    return () => clearTimeout(t)
  }, [ventaCompletada, resetVenta])

  const buscarProducto = useCallback(async (query: string) => {
    setBusqueda(query)
    if (!query.trim()) { setResultados([]); return }
    const q = query.toLowerCase()
    const matches = productos.filter(
      (p) => p.activo && (
        p.nombre.toLowerCase().includes(q) ||
        p.codigoBarras?.includes(query) ||
        p.codigoInterno?.toLowerCase().includes(q)
      )
    ).slice(0, 8)
    setResultados(matches)
  }, [productos])

  const handleBusquedaKey = useCallback(async (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // Try barcode first (exact match)
      const byBarcode = await findByBarcode(busqueda)
      if (byBarcode) {
        agregarProducto(byBarcode)
        setBusqueda('')
        setResultados([])
        return
      }
      // Otherwise select first result
      if (resultados[0]) {
        agregarProducto(resultados[0])
        setBusqueda('')
        setResultados([])
      }
    }
    if (e.key === 'Escape') {
      setBusqueda('')
      setResultados([])
    }
  }, [busqueda, resultados, findByBarcode, agregarProducto])

  const handleSeleccionar = useCallback((p: Producto) => {
    agregarProducto(p)
    setBusqueda('')
    setResultados([])
    busquedaRef.current?.focus()
  }, [agregarProducto])

  const handleCobrar = useCallback(() => {
    if (items.length === 0) return
    if (!turnoActual) { alert('No hay un turno de caja abierto'); return }
    const totalVenta = total()
    setEfectivoIngresado(String(Math.ceil(totalVenta)))
    agregarPago('efectivo', totalVenta)
    setMostrarPago(true)
  }, [items, turnoActual, total, agregarPago])

  const handleConfirmarPago = useCallback(async () => {
    if (!turnoActual || !usuario) return
    try {
      await completarVenta(turnoActual.cajaId, 1, usuario.id)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al procesar el pago')
    }
  }, [turnoActual, usuario, completarVenta])

  const efectivoNum = Number(efectivoIngresado) || 0
  const vueltoEfectivo = Math.max(0, efectivoNum - total())

  if (!turnoActual) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400">
        <p className="text-4xl mb-4">💰</p>
        <p className="text-xl font-semibold">No hay caja abierta</p>
        <p className="text-sm mt-2">Abrí un turno desde el módulo de Caja (F4)</p>
      </div>
    )
  }

  return (
    <div className="flex h-full gap-4">
      {/* Left: producto search + carrito */}
      <div className="flex-1 flex flex-col gap-3">
        {/* Search bar */}
        <div className="relative">
          <input
            ref={busquedaRef}
            value={busqueda}
            onChange={(e) => buscarProducto(e.target.value)}
            onKeyDown={handleBusquedaKey}
            placeholder="Escanear código o buscar producto... (Enter para agregar)"
            className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-lg outline-none focus:border-blue-500 transition-colors"
            autoComplete="off"
          />
          {resultados.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
              {resultados.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSeleccionar(p)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-50 text-left border-b border-slate-100 last:border-0"
                >
                  <div>
                    <p className="font-medium text-slate-800">{p.nombre}</p>
                    <p className="text-xs text-slate-400">{p.codigoBarras ?? p.codigoInterno ?? 'Sin código'}</p>
                  </div>
                  <span className="font-bold text-blue-600">{formatPrecio(p.precioVenta)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Carrito */}
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-300">
              <p className="text-center">
                <span className="text-5xl block mb-3">🛒</span>
                Escaneá o buscá productos
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {items.map((item) => (
                <div
                  key={item.productoId}
                  className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-slate-100"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate">{item.producto.nombre}</p>
                    <p className="text-sm text-slate-400">{formatPrecio(item.precioUnitario)} c/u</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => actualizarCantidad(item.productoId, item.cantidad - 1)}
                      className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-600 flex items-center justify-center"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      value={item.cantidad}
                      onChange={(e) => actualizarCantidad(item.productoId, Number(e.target.value))}
                      className="w-14 text-center border border-slate-200 rounded-lg py-1 text-sm font-semibold"
                      min={1}
                    />
                    <button
                      onClick={() => actualizarCantidad(item.productoId, item.cantidad + 1)}
                      className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-600 flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                  <span className="font-bold text-slate-800 w-24 text-right">
                    {formatPrecio(item.subtotal)}
                  </span>
                  <button
                    onClick={() => quitarItem(item.productoId)}
                    className="text-slate-300 hover:text-red-400 text-lg leading-none"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totales */}
        {items.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex justify-between text-sm text-slate-500 mb-1">
              <span>Subtotal</span>
              <span>{formatPrecio(subtotal())}</span>
            </div>
            {descuentoTotal > 0 && (
              <div className="flex justify-between text-sm text-green-600 mb-1">
                <span>Descuento</span>
                <span>− {formatPrecio(descuentoTotal)}</span>
              </div>
            )}
            <div className="flex justify-between text-2xl font-bold text-slate-800 border-t border-slate-100 pt-2 mt-2">
              <span>TOTAL</span>
              <span className="text-blue-600">{formatPrecio(total())}</span>
            </div>
          </div>
        )}
      </div>

      {/* Right: cobro panel */}
      <div className="w-72 flex flex-col gap-3">
        {!mostrarPago ? (
          <>
            <div className="flex-1" />
            <Button
              size="xl"
              onClick={handleCobrar}
              disabled={items.length === 0}
              className="w-full text-xl py-6"
            >
              Cobrar (F4)
            </Button>
            <Button
              variant="outline"
              onClick={resetVenta}
              disabled={items.length === 0}
              className="w-full"
            >
              Cancelar venta
            </Button>
          </>
        ) : (
          <div className="flex flex-col gap-3 h-full">
            <div className="bg-slate-800 rounded-xl p-4 text-white text-center">
              <p className="text-sm text-slate-400">Total a cobrar</p>
              <p className="text-4xl font-bold mt-1">{formatPrecio(total())}</p>
            </div>

            {/* Medio de pago selector */}
            <div className="grid grid-cols-2 gap-2">
              {MEDIOS_PAGO.map((mp) => (
                <button
                  key={mp.key}
                  onClick={() => { setMedioPagoActivo(mp.key); agregarPago(mp.key, total()) }}
                  className={`flex flex-col items-center py-3 rounded-xl border-2 text-sm font-semibold transition-colors ${
                    pagos.some((p) => p.medioPago === mp.key)
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span className="text-xl">{mp.icon}</span>
                  {mp.label}
                </button>
              ))}
            </div>

            {/* Efectivo recibido */}
            {pagos.some((p) => p.medioPago === 'efectivo') && (
              <div className="bg-white rounded-xl border border-slate-200 p-3">
                <p className="text-xs text-slate-500 mb-1">Efectivo recibido</p>
                <input
                  type="number"
                  value={efectivoIngresado}
                  onChange={(e) => setEfectivoIngresado(e.target.value)}
                  className="w-full text-2xl font-bold text-center border-b-2 border-blue-400 outline-none py-1"
                  inputMode="numeric"
                  autoFocus
                />
                <div className="flex justify-between mt-2 text-sm">
                  <span className="text-slate-500">Vuelto</span>
                  <span className={`font-bold ${vueltoEfectivo >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {formatPrecio(vueltoEfectivo)}
                  </span>
                </div>
              </div>
            )}

            <div className="flex-1" />

            {ventaCompletada ? (
              <div className="flex flex-col gap-2">
                <div className="bg-green-500 text-white rounded-xl p-4 text-center font-bold text-lg">
                  ✓ Venta completada #{ventaCompletada}
                </div>
                <Button
                  variant="outline"
                  onClick={() => invoke('impresion:ticketVenta', { ventaId: ventaCompletada })}
                  className="w-full"
                >
                  🖨️ Imprimir ticket
                </Button>
              </div>
            ) : (
              <>
                <Button
                  size="xl"
                  variant="success"
                  onClick={handleConfirmarPago}
                  disabled={isLoading || pagos.length === 0}
                  className="w-full"
                >
                  {isLoading ? 'Procesando...' : 'Confirmar pago'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setMostrarPago(false)}
                  className="w-full"
                >
                  Volver
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
