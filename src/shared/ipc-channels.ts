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
  // Clientes
  'clientes:list': {
    request: { search?: string }
    response: import('./types').Cliente[]
  }
  'clientes:get': {
    request: { id: number }
    response: import('./types').Cliente
  }
  'clientes:create': {
    request: Omit<import('./types').Cliente, 'id' | 'saldoCuentaCorriente' | 'activo'>
    response: import('./types').Cliente
  }
  'clientes:update': {
    request: { id: number } & Partial<Omit<import('./types').Cliente, 'id' | 'saldoCuentaCorriente'>>
    response: import('./types').Cliente
  }
  'clientes:delete': {
    request: { id: number }
    response: void
  }
  'clientes:estadoCuenta': {
    request: { clienteId: number }
    response: {
      cliente: import('./types').Cliente
      ventas: { id: number; fecha: string; total: number; estado: string }[]
      cobranzas: { id: number; fecha: string; monto: number; medioPago: string; observacion: string | null }[]
      saldoActual: number
    }
  }
  'clientes:registrarCobranza': {
    request: { clienteId: number; monto: number; medioPago: string; observacion?: string; usuarioId: number }
    response: void
  }
  // Proveedores
  'proveedores:list': {
    request: Record<string, never>
    response: import('./types').Proveedor[]
  }
  'proveedores:create': {
    request: Omit<import('./types').Proveedor, 'id' | 'activo'>
    response: import('./types').Proveedor
  }
  'proveedores:update': {
    request: { id: number } & Partial<Omit<import('./types').Proveedor, 'id'>>
    response: import('./types').Proveedor
  }
  'proveedores:delete': {
    request: { id: number }
    response: void
  }
  // Compras
  'compras:list': {
    request: { proveedorId?: number }
    response: import('./types').OrdenCompra[]
  }
  'compras:get': {
    request: { id: number }
    response: import('./types').OrdenCompra & { items: import('./types').ItemOrdenCompra[] }
  }
  'compras:crear': {
    request: import('./types').NuevaCompraRequest
    response: import('./types').OrdenCompra
  }
  'compras:recibir': {
    request: { compraId: number; usuarioId: number }
    response: void
  }
  // Usuarios admin
  'usuarios:update': {
    request: { id: number; nombre: string; rol: import('./types').RolUsuario; pin?: string; activo: boolean; negocioId?: number }
    response: import('./types').Usuario
  }
  'usuarios:delete': {
    request: { id: number }
    response: void
  }
  'usuarios:listAll': {
    request: Record<string, never>
    response: import('./types').Usuario[]
  }
  // Impresión
  'impresion:ticketVenta': {
    request: { ventaId: number }
    response: boolean
  }
  'impresion:ticketCierre': {
    request: { turnoId: number }
    response: boolean
  }
  // Reportes
  'reportes:ventas': {
    request: { desde: string; hasta: string; agruparPor: 'dia' | 'semana' | 'mes' }
    response: {
      filas: import('./types').FilaVentaReporte[]
      grupos: import('./types').GrupoVentasReporte[]
      resumen: import('./types').ResumenVentasReporte
    }
  }
  'reportes:ranking': {
    request: { desde: string; hasta: string; limit?: number }
    response: import('./types').RankingProducto[]
  }
  'reportes:porMedioPago': {
    request: { desde: string; hasta: string }
    response: import('./types').MedioPagoReporte[]
  }
  'reportes:stockValorizado': {
    request: Record<string, never>
    response: {
      productos: import('./types').ProductoStockValorizado[]
      totalValorCosto: number
      totalValorVenta: number
    }
  }
}

export type IpcChannels = IpcChannelMap
export type IpcRequest<C extends keyof IpcChannels> = IpcChannels[C]['request']
export type IpcResponse<C extends keyof IpcChannels> = IpcChannels[C]['response']

export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }
