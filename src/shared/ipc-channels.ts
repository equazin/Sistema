// Typed IPC channel definitions
// Each entry: request type → response type

export interface IpcChannelMap {
  // Productos
  'productos:list': {
    request: { page?: number; limit?: number; search?: string; categoriaId?: number }
    response: { items: import('./types').Producto[]; total: number }
  }
  'productos:get': {
    request: { id: number }
    response: import('./types').Producto
  }
  'productos:create': {
    request: Omit<import('./types').Producto, 'id' | 'updatedAt'>
    response: import('./types').Producto
  }
  'productos:update': {
    request: { id: number } & Partial<import('./types').Producto>
    response: import('./types').Producto
  }
  'productos:delete': {
    request: { id: number }
    response: void
  }
  'productos:findByBarcode': {
    request: { barcode: string }
    response: import('./types').Producto | null
  }
  // Categorias
  'categorias:list': {
    request: Record<string, never>
    response: import('./types').Categoria[]
  }
  'categorias:create': {
    request: { nombre: string; categoriaPadreId?: number }
    response: import('./types').Categoria
  }
  // Usuarios
  'usuarios:login': {
    request: { pin: string }
    response: import('./types').Usuario
  }
  'usuarios:list': {
    request: Record<string, never>
    response: import('./types').Usuario[]
  }
  'usuarios:create': {
    request: Omit<import('./types').Usuario, 'id'>
    response: import('./types').Usuario
  }
  // Negocio
  'negocio:get': {
    request: Record<string, never>
    response: import('./types').Negocio | null
  }
  'negocio:save': {
    request: Partial<import('./types').Negocio>
    response: import('./types').Negocio
  }
  // Caja / Turnos
  'turno:abrir': {
    request: { cajaId: number; usuarioId: number; montoApertura: number }
    response: import('./types').TurnoCaja
  }
  'turno:cerrar': {
    request: { turnoId: number; montoCierreDeclado: number }
    response: import('./types').TurnoCaja
  }
  'turno:actual': {
    request: { cajaId: number }
    response: import('./types').TurnoCaja | null
  }
  // Ventas
  'ventas:crear': {
    request: import('./types').NuevaVentaRequest
    response: import('./types').Venta
  }
  'ventas:list': {
    request: { turnoId?: number; fecha?: string }
    response: import('./types').Venta[]
  }
  'ventas:get': {
    request: { id: number }
    response: import('./types').VentaDetalle
  }
  // Stock
  'stock:movimientos': {
    request: { productoId?: number; limit?: number }
    response: import('./types').MovimientoStock[]
  }
  'stock:ajustar': {
    request: { productoId: number; cantidad: number; motivo: string; usuarioId: number }
    response: void
  }
}

export type IpcChannels = IpcChannelMap
export type IpcRequest<C extends keyof IpcChannels> = IpcChannels[C]['request']
export type IpcResponse<C extends keyof IpcChannels> = IpcChannels[C]['response']

export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }
