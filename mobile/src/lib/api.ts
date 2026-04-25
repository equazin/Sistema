import AsyncStorage from '@react-native-async-storage/async-storage'

const CONFIG_KEY = 'api_config'

export interface ApiConfig {
  baseUrl: string
  apiKey: string
}

export async function getConfig(): Promise<ApiConfig | null> {
  const raw = await AsyncStorage.getItem(CONFIG_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) as ApiConfig } catch { return null }
}

export async function saveConfig(config: ApiConfig): Promise<void> {
  await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(config))
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const config = await getConfig()
  if (!config) throw new Error('API no configurada. Ir a Configuración.')

  const res = await fetch(`${config.baseUrl}/api/v1${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': config.apiKey,
      ...options?.headers,
    },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string }
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }

  const json = await res.json() as { data: T }
  return json.data
}

export const api = {
  health: () => request<{ status: string; version: string; timestamp: string }>('/health'),
  productos: (params?: { page?: number; limit?: number; search?: string }) => {
    const qs = new URLSearchParams()
    if (params?.page) qs.set('page', String(params.page))
    if (params?.limit) qs.set('limit', String(params.limit))
    if (params?.search) qs.set('search', params.search)
    return request<{ items: ProductoAPI[]; total: number; page: number; limit: number }>(`/productos?${qs}`)
  },
  productoByBarcode: (code: string) => request<ProductoAPI>(`/productos/barcode/${encodeURIComponent(code)}`),
  ventas: (params?: { page?: number; limit?: number; fecha?: string; turnoId?: number }) => {
    const qs = new URLSearchParams()
    if (params?.page) qs.set('page', String(params.page))
    if (params?.limit) qs.set('limit', String(params.limit))
    if (params?.fecha) qs.set('fecha', params.fecha)
    if (params?.turnoId) qs.set('turno_id', String(params.turnoId))
    return request<{ items: VentaAPI[]; total: number; page: number; limit: number }>(`/ventas?${qs}`)
  },
  stock: (params?: { soloStockBajo?: boolean; search?: string }) => {
    const qs = new URLSearchParams()
    if (params?.soloStockBajo) qs.set('stock_bajo', '1')
    if (params?.search) qs.set('search', params.search)
    return request<{ items: StockAPI[]; total: number }>(`/stock?${qs}`)
  },
  caja: () => request<CajaAPI>('/caja/estado'),
  clientes: (params?: { search?: string; conDeuda?: boolean }) => {
    const qs = new URLSearchParams()
    if (params?.search) qs.set('search', params.search)
    if (params?.conDeuda) qs.set('con_deuda', '1')
    return request<{ items: ClienteAPI[]; total: number; page: number; limit: number }>(`/clientes?${qs}`)
  },
}

export interface ProductoAPI {
  id: number
  nombre: string
  codigoBarras: string | null
  precioVenta: number
  stockActual: number
  stockMinimo: number
  categoria: string | null
}

export interface VentaAPI {
  id: number
  fecha: string
  total: number
  estado: string
  tipoComprobante: string
}

export interface StockAPI {
  id: number
  nombre: string
  codigoBarras: string | null
  stockActual: number
  stockMinimo: number
  bajoMinimo: boolean
}

export interface CajaAPI {
  turnoActivo: boolean
  turnoId: number | null
  cajaId: number | null
  sucursalId: number | null
  montoApertura: number
  ventasHoy: number
  totalHoy: number
}

export interface ClienteAPI {
  id: number
  nombre: string
  cuitDni: string | null
  telefono: string | null
  saldoCuentaCorriente: number
}
