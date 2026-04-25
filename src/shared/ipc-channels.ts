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
    request: Omit<import('./types').Producto, 'id' | 'updatedAt'> & { usuarioId?: number }
    response: import('./types').Producto
  }
  'productos:update': {
    request: { id: number; usuarioId?: number } & Partial<import('./types').Producto>
    response: import('./types').Producto
  }
  'productos:delete': {
    request: { id: number; usuarioId?: number }
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
    request: { turnoId: number; montoCierreDeclado: number; usuarioId: number }
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
    request: Omit<import('./types').Cliente, 'id' | 'saldoCuentaCorriente' | 'activo'> & { usuarioId?: number }
    response: import('./types').Cliente
  }
  'clientes:update': {
    request: { id: number; usuarioId?: number } & Partial<Omit<import('./types').Cliente, 'id' | 'saldoCuentaCorriente'>>
    response: import('./types').Cliente
  }
  'clientes:delete': {
    request: { id: number; usuarioId?: number }
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
  'reportes:cuentaCorriente': {
    request: { desde: string; hasta: string; clienteId?: number }
    response: {
      filas: import('./types').FilaCuentaCorrienteReporte[]
      resumen: { totalDeuda: number; totalCobrado: number; saldoFinal: number; clientesConDeuda: number }
    }
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
  'compras:sugerenciasReorden': {
    request: { proveedorId?: number; categoriaId?: number }
    response: import('./types').SugerenciaReorden[]
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
  // Auditoria
  'auditoria:list': {
    request: { limit?: number }
    response: import('./types').AuditoriaEntry[]
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
  'impresion:previewVenta': {
    request: { ventaId: number }
    response: { html: string; anchoTicket: import('./types').TicketAncho }
  }
  'impresion:previewCierre': {
    request: { turnoId: number }
    response: { html: string; anchoTicket: import('./types').TicketAncho }
  }
  'config:impresion:get': {
    request: Record<string, never>
    response: import('./types').ImpresionConfig
  }
  'config:impresion:set': {
    request: import('./types').ImpresionConfig
    response: void
  }
  'config:impresion:listPrinters': {
    request: Record<string, never>
    response: import('./types').ImpresoraSistema[]
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
  // MercadoPago QR
  'mp:crearOrden': {
    request: { monto: number; descripcion: string; externalReference: string }
    response: { orderId: string; qrData: string; ticketUrl: string }
  }
  'mp:consultarEstado': {
    request: { orderId: string }
    response: { estado: 'pending' | 'approved' | 'rejected' | 'cancelled' }
  }
  'mp:cancelarOrden': {
    request: { orderId: string }
    response: void
  }
  'config:mp:get': {
    request: Record<string, never>
    response: { accessToken: string; posId: string; sucursalId: string } | null
  }
  'config:mp:set': {
    request: { accessToken: string; posId: string; sucursalId: string }
    response: void
  }
  // Promociones
  'promociones:list': {
    request: Record<string, never>
    response: import('./types').Promocion[]
  }
  'promociones:create': {
    request: Omit<import('./types').Promocion, 'id' | 'createdAt'>
    response: import('./types').Promocion
  }
  'promociones:update': {
    request: { id: number } & Partial<import('./types').Promocion>
    response: import('./types').Promocion
  }
  'promociones:delete': {
    request: { id: number }
    response: void
  }
  'promociones:calcular': {
    request: {
      items: { productoId: number; cantidad: number; precioUnitario: number; categoriaId: number | null }[]
      medioPago: string
    }
    response: {
      descuentoTotal: number
      detalle: { promocionId: number; nombre: string; descuento: number }[]
    }
  }
  // Backup
  'backup:ejecutar': {
    request: { destino?: string }
    response: { path: string; fecha: string }
  }
  'backup:getConfig': {
    request: Record<string, never>
    response: { carpeta: string; frecuencia: 'diario' | 'semanal' | 'manual' } | null
  }
  'backup:setConfig': {
    request: { carpeta: string; frecuencia: 'diario' | 'semanal' | 'manual' }
    response: void
  }
  'backup:listar': {
    request: Record<string, never>
    response: { nombre: string; path: string; tamaño: number; fecha: string }[]
  }
  // Actualización masiva de precios
  'precios:preview': {
    request: import('./types').ActualizacionMasiva
    response: import('./types').PreviewPrecio[]
  }
  'precios:aplicar': {
    request: import('./types').ActualizacionMasiva & { usuarioId: number }
    response: { actualizados: number }
  }
  'precios:parsearCSV': {
    request: { contenido: string }
    response: { items: { codigoBarras: string; precioVenta: number }[]; errores: string[] }
  }
}

export type IpcChannels = IpcChannelMap
export type IpcRequest<C extends keyof IpcChannels> = IpcChannels[C]['request']
export type IpcResponse<C extends keyof IpcChannels> = IpcChannels[C]['response']

export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }
