import { create } from 'zustand'
import type { Producto, Categoria } from '../../../shared/types'
import { invoke } from '../lib/api'

interface ProductosState {
  productos: Producto[]
  categorias: Categoria[]
  total: number
  page: number
  search: string
  isLoading: boolean
  error: string | null

  fetchProductos: () => Promise<void>
  fetchCategorias: () => Promise<void>
  setSearch: (search: string) => void
  setPage: (page: number) => void
  createProducto: (data: Omit<Producto, 'id' | 'updatedAt'>) => Promise<Producto>
  updateProducto: (id: number, data: Partial<Producto>) => Promise<Producto>
  deleteProducto: (id: number) => Promise<void>
  findByBarcode: (barcode: string) => Promise<Producto | null>
}

export const useProductosStore = create<ProductosState>((set, get) => ({
  productos: [],
  categorias: [],
  total: 0,
  page: 1,
  search: '',
  isLoading: false,
  error: null,

  fetchProductos: async () => {
    set({ isLoading: true, error: null })
    try {
      const { page, search } = get()
      const result = await invoke('productos:list', { page, limit: 50, search: search || undefined })
      set({ productos: result.items, total: result.total, isLoading: false })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Error', isLoading: false })
    }
  },

  fetchCategorias: async () => {
    try {
      const cats = await invoke('categorias:list', {})
      set({ categorias: cats })
    } catch { /* ignore */ }
  },

  setSearch: (search) => {
    set({ search, page: 1 })
    get().fetchProductos()
  },

  setPage: (page) => {
    set({ page })
    get().fetchProductos()
  },

  createProducto: async (data) => {
    const producto = await invoke('productos:create', data)
    await get().fetchProductos()
    return producto
  },

  updateProducto: async (id, data) => {
    const producto = await invoke('productos:update', { id, ...data })
    set((state) => ({
      productos: state.productos.map((p) => (p.id === id ? producto : p)),
    }))
    return producto
  },

  deleteProducto: async (id) => {
    await invoke('productos:delete', { id })
    set((state) => ({
      productos: state.productos.filter((p) => p.id !== id),
      total: state.total - 1,
    }))
  },

  findByBarcode: async (barcode) => {
    return invoke('productos:findByBarcode', { barcode })
  },
}))
