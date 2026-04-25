import { create } from 'zustand'
import type { Producto, ItemVenta, PagoVenta, MedioPago } from '../../../shared/types'
import { invoke } from '../lib/api'

export interface ItemCarrito extends ItemVenta {
  producto: Producto
}

interface PromocionAplicada {
  promocionId: number
  nombre: string
  descuento: number
}

interface VentaState {
  items: ItemCarrito[]
  pagos: PagoVenta[]
  descuentoTotal: number
  promocionesAplicadas: PromocionAplicada[]
  isLoading: boolean
  ventaCompletada: number | null

  agregarProducto: (producto: Producto, cantidad?: number) => void
  quitarItem: (productoId: number) => void
  actualizarCantidad: (productoId: number, cantidad: number) => void
  setDescuento: (descuento: number) => void
  agregarPago: (medioPago: MedioPago, monto: number) => void
  quitarPago: (medioPago: MedioPago) => void
  calcularPromociones: (medioPago: string) => Promise<void>
  completarVenta: (turnoId: number, sucursalId: number, usuarioId: number) => Promise<void>
  resetVenta: () => void

  // Computed
  subtotal: () => number
  total: () => number
  totalPagado: () => number
  vuelto: () => number
}

export const useVentaStore = create<VentaState>((set, get) => ({
  items: [],
  pagos: [],
  descuentoTotal: 0,
  promocionesAplicadas: [],
  isLoading: false,
  ventaCompletada: null,

  agregarProducto: (producto, cantidad = 1) => {
    set((state) => {
      const existing = state.items.find((i) => i.productoId === producto.id)
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.productoId === producto.id
              ? {
                  ...i,
                  cantidad: i.cantidad + cantidad,
                  subtotal: (i.cantidad + cantidad) * i.precioUnitario - i.descuento,
                }
              : i
          ),
        }
      }
      const nuevoItem: ItemCarrito = {
        productoId: producto.id,
        cantidad,
        precioUnitario: producto.precioVenta,
        descuento: 0,
        subtotal: cantidad * producto.precioVenta,
        pesable: producto.pesable,
        producto,
      }
      return { items: [...state.items, nuevoItem] }
    })
  },

  quitarItem: (productoId) => {
    set((state) => ({
      items: state.items.filter((i) => i.productoId !== productoId),
    }))
  },

  actualizarCantidad: (productoId, cantidad) => {
    if (cantidad <= 0) {
      get().quitarItem(productoId)
      return
    }
    set((state) => ({
      items: state.items.map((i) =>
        i.productoId === productoId
          ? { ...i, cantidad, subtotal: cantidad * i.precioUnitario - i.descuento }
          : i
      ),
    }))
  },

  setDescuento: (descuento) => set({ descuentoTotal: descuento }),

  agregarPago: (medioPago, monto) => {
    set((state) => {
      const existing = state.pagos.find((p) => p.medioPago === medioPago)
      if (existing) {
        return {
          pagos: state.pagos.map((p) =>
            p.medioPago === medioPago ? { ...p, monto } : p
          ),
        }
      }
      return { pagos: [...state.pagos, { medioPago, monto, referencia: null }] }
    })
  },

  quitarPago: (medioPago) => {
    set((state) => ({ pagos: state.pagos.filter((p) => p.medioPago !== medioPago) }))
  },

  calcularPromociones: async (medioPago) => {
    const { items } = get()
    if (items.length === 0) {
      set({ descuentoTotal: 0, promocionesAplicadas: [] })
      return
    }
    try {
      const resultado = await invoke('promociones:calcular', {
        items: items.map((i) => ({
          productoId: i.productoId,
          cantidad: i.cantidad,
          precioUnitario: i.precioUnitario,
          categoriaId: i.producto.categoriaId,
        })),
        medioPago,
      })
      set({
        descuentoTotal: resultado.descuentoTotal,
        promocionesAplicadas: resultado.detalle,
      })
    } catch {
      // Si falla el cálculo de promociones, no bloqueamos la venta
      set({ descuentoTotal: 0, promocionesAplicadas: [] })
    }
  },

  completarVenta: async (turnoId, sucursalId, usuarioId) => {
    const { items, pagos, descuentoTotal } = get()
    if (items.length === 0) throw new Error('No hay productos en la venta')

    set({ isLoading: true })
    try {
      const venta = await invoke('ventas:crear', {
        turnoId,
        sucursalId,
        usuarioId,
        clienteId: null,
        items: items.map(({ producto: _p, ...item }) => item),
        pagos,
        descuentoTotal,
        tipoComprobante: 'ticket',
      })
      set({ ventaCompletada: venta.id, isLoading: false })
    } catch (err) {
      set({ isLoading: false })
      throw err
    }
  },

  resetVenta: () => set({
    items: [],
    pagos: [],
    descuentoTotal: 0,
    promocionesAplicadas: [],
    ventaCompletada: null,
    isLoading: false,
  }),

  subtotal: () => get().items.reduce((sum, i) => sum + i.subtotal, 0),
  total: () => get().subtotal() - get().descuentoTotal,
  totalPagado: () => get().pagos.reduce((sum, p) => sum + p.monto, 0),
  vuelto: () => Math.max(0, get().totalPagado() - get().total()),
}))
