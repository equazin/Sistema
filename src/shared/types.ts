// Shared domain types used in both main and renderer processes

export interface Negocio {
  id: number
  nombre: string
  razonSocial: string
  cuit: string
  condicionAfip: 'monotributo' | 'responsable_inscripto' | 'exento' | 'consumidor_final'
  domicilio: string
  telefono: string
  logoPath: string | null
  createdAt: string
}

export interface Sucursal {
  id: number
  negocioId: number
  nombre: string
  domicilio: string
  activa: boolean
}

export type RolUsuario = 'admin' | 'encargado' | 'cajero' | 'lectura'

export interface Usuario {
  id: number
  negocioId: number
  nombre: string
  pin: string
  rol: RolUsuario
  activo: boolean
}

export interface Categoria {
  id: number
  negocioId: number
  nombre: string
  categoriaPadreId: number | null
}

export type UnidadMedida = 'unidad' | 'kg' | 'gr' | 'lt' | 'ml'

export interface Producto {
  id: number
  negocioId: number
  codigoBarras: string | null
  codigoInterno: string | null
  nombre: string
  descripcion: string | null
  categoriaId: number | null
  unidadMedida: UnidadMedida
  precioCosto: number
  precioVenta: number
  precioMayorista: number | null
  stockActual: number
  stockMinimo: number
  stockMaximo: number | null
  pesable: boolean
  activo: boolean
  updatedAt: string
}

export interface TurnoCaja {
  id: number
  cajaId: number
  usuarioId: number
  aperturaAt: string
  cierreAt: string | null
  montoApertura: number
  montoCierreDeclado: number | null
  montoCierre_sistema: number | null
  diferencia: number | null
  estado: 'abierto' | 'cerrado'
}

export type MedioPago = 'efectivo' | 'debito' | 'credito' | 'qr_mp' | 'transferencia' | 'cuenta_corriente'
export type TipoComprobante = 'ticket' | 'factura_a' | 'factura_b' | 'factura_c' | 'presupuesto'
export type EstadoVenta = 'completada' | 'anulada' | 'devuelta'

export interface ItemVenta {
  productoId: number
  cantidad: number
  precioUnitario: number
  descuento: number
  subtotal: number
  pesable: boolean
}

export interface PagoVenta {
  medioPago: MedioPago
  monto: number
  referencia: string | null
}

export interface NuevaVentaRequest {
  turnoId: number
  sucursalId: number
  usuarioId: number
  clienteId: number | null
  items: ItemVenta[]
  pagos: PagoVenta[]
  descuentoTotal: number
  tipoComprobante: TipoComprobante
}

export interface Venta {
  id: number
  turnoId: number
  sucursalId: number
  usuarioId: number
  clienteId: number | null
  fecha: string
  subtotal: number
  descuentoTotal: number
  total: number
  estado: EstadoVenta
  tipoComprobante: TipoComprobante
  cae: string | null
  caeVencimiento: string | null
  numeroComprobante: string | null
}

export interface VentaDetalle extends Venta {
  items: (ItemVenta & { nombreProducto: string })[]
  pagos: PagoVenta[]
}

export interface MovimientoStock {
  id: number
  productoId: number
  tipo: 'entrada' | 'salida' | 'ajuste' | 'transferencia' | 'devolucion'
  cantidad: number
  cantidadAnterior: number
  motivo: string | null
  referenciaId: number | null
  referenciaTipo: string | null
  usuarioId: number | null
  fecha: string
}

export interface Caja {
  id: number
  sucursalId: number
  nombre: string
}

export interface Cliente {
  id: number
  negocioId: number
  nombre: string
  cuitDni: string | null
  telefono: string | null
  email: string | null
  condicionAfip: 'monotributo' | 'responsable_inscripto' | 'exento' | 'consumidor_final'
  limiteCredito: number
  saldoCuentaCorriente: number
  activo: boolean
}

export interface Proveedor {
  id: number
  negocioId: number
  nombre: string
  cuit: string | null
  telefono: string | null
  email: string | null
  condicionPago: string | null
  activo: boolean
}

export interface OrdenCompra {
  id: number
  proveedorId: number
  nombreProveedor: string
  usuarioId: number
  fecha: string
  total: number
  estado: 'pendiente' | 'recibida' | 'cancelada'
}

export interface ItemOrdenCompra {
  productoId: number
  nombreProducto: string
  cantidad: number
  precioUnitario: number
  subtotal: number
}

export interface NuevaCompraRequest {
  proveedorId: number
  usuarioId: number
  items: { productoId: number; cantidad: number; precioUnitario: number; subtotal: number }[]
}

export interface SugerenciaReorden {
  productoId: number
  nombreProducto: string
  stockActual: number
  stockMinimo: number
  stockMaximo: number | null
  cantidadSugerida: number
  precioCosto: number
  proveedorId: number | null
  nombreProveedor: string | null
}

// Reportes

export interface FilaVentaReporte {
  id: number
  fecha: string
  total: number
  subtotal: number
  descuentoTotal: number
  tipoComprobante: string
  estado: string
  usuarioId: number
  nombreUsuario: string
}

export interface GrupoVentasReporte {
  periodo: string
  total: number
  cantidad: number
  subtotal: number
  descuentos: number
}

export interface ResumenVentasReporte {
  totalVentas: number
  totalRecaudado: number
  ticketPromedio: number
  totalDescuentos: number
}

export interface RankingProducto {
  posicion: number
  productoId: number
  nombre: string
  codigoBarras: string | null
  precioVenta: number
  cantidadVendida: number
  totalVendido: number
  apariciones: number
}

export interface MedioPagoReporte {
  medioPago: string
  cantidad: number
  total: number
}

export interface ProductoStockValorizado {
  id: number
  nombre: string
  codigoBarras: string | null
  categoria: string | null
  stockActual: number
  stockMinimo: number
  precioCosto: number
  precioVenta: number
  valorCosto: number
  valorVenta: number
  bajoMinimo: boolean
}

export interface PreviewPrecio {
  productoId: number
  codigoBarras: string | null
  nombre: string
  precioActual: number
  precioNuevo: number
  diferencia: number
  diferenciaPct: number
}

export interface ActualizacionMasiva {
  tipo: 'porcentaje' | 'csv'
  porcentaje?: number
  redondear?: 'ninguno' | 'entero' | 'decena' | 'centena'
  soloCategoria?: number | null
  soloActivos?: boolean
  items?: { codigoBarras: string; precioVenta: number }[]
}

export type TipoPromocion =
  | 'porcentaje_producto'
  | 'porcentaje_categoria'
  | 'porcentaje_medio_pago'
  | '2x1'
  | '3x2'
  | 'monto_fijo'

export interface Promocion {
  id: number
  negocioId: number
  nombre: string
  tipo: TipoPromocion
  valor: number
  productoId: number | null
  categoriaId: number | null
  medioPago: string | null
  vigenciaDesde: string | null
  vigenciaHasta: string | null
  activa: boolean
  createdAt: string
}

export type TicketAncho = '58mm' | '80mm'

export interface ImpresionConfig {
  anchoTicket: TicketAncho
  printerName: string
}

export interface ImpresoraSistema {
  name: string
  displayName: string
  isDefault: boolean
  status: number
}

export interface AuditoriaEntry {
  id: number
  usuarioId: number | null
  nombreUsuario: string | null
  accion: string
  tabla: string | null
  referenciaId: number | null
  detalle: string | null
  fecha: string
}

export interface FilaCuentaCorrienteReporte {
  clienteId: number
  nombreCliente: string
  saldoActual: number
  limiteCredito: number
  totalVendidoPeriodo: number
  totalCobradoPeriodo: number
  cantidadVentas: number
}
