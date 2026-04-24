import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

export const negocios = sqliteTable('negocios', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nombre: text('nombre').notNull(),
  razonSocial: text('razon_social').notNull(),
  cuit: text('cuit').notNull(),
  condicionAfip: text('condicion_afip', {
    enum: ['monotributo', 'responsable_inscripto', 'exento', 'consumidor_final'],
  }).notNull().default('monotributo'),
  domicilio: text('domicilio').notNull().default(''),
  telefono: text('telefono').notNull().default(''),
  logoPath: text('logo_path'),
  createdAt: text('created_at').notNull().default("(datetime('now','localtime'))"),
})

export const modulosActivos = sqliteTable('modulos_activos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  negocioId: integer('negocio_id').notNull().references(() => negocios.id),
  moduloKey: text('modulo_key').notNull(),
  activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
  activadoEn: text('activado_en').notNull().default("(datetime('now','localtime'))"),
})

export const sucursales = sqliteTable('sucursales', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  negocioId: integer('negocio_id').notNull().references(() => negocios.id),
  nombre: text('nombre').notNull(),
  domicilio: text('domicilio').notNull().default(''),
  activa: integer('activa', { mode: 'boolean' }).notNull().default(true),
})

export const usuarios = sqliteTable('usuarios', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  negocioId: integer('negocio_id').notNull().references(() => negocios.id),
  nombre: text('nombre').notNull(),
  pin: text('pin').notNull(),
  rol: text('rol', { enum: ['admin', 'encargado', 'cajero', 'lectura'] }).notNull().default('cajero'),
  activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
})

export const categorias = sqliteTable('categorias', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  negocioId: integer('negocio_id').notNull().references(() => negocios.id),
  nombre: text('nombre').notNull(),
  categoriaPadreId: integer('categoria_padre_id'),
})

export const productos = sqliteTable(
  'productos',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    negocioId: integer('negocio_id').notNull().references(() => negocios.id),
    codigoBarras: text('codigo_barras'),
    codigoInterno: text('codigo_interno'),
    nombre: text('nombre').notNull(),
    descripcion: text('descripcion'),
    categoriaId: integer('categoria_id').references(() => categorias.id),
    unidadMedida: text('unidad_medida', {
      enum: ['unidad', 'kg', 'gr', 'lt', 'ml'],
    }).notNull().default('unidad'),
    precioCosto: real('precio_costo').notNull().default(0),
    precioVenta: real('precio_venta').notNull().default(0),
    precioMayorista: real('precio_mayorista'),
    stockActual: real('stock_actual').notNull().default(0),
    stockMinimo: real('stock_minimo').notNull().default(0),
    stockMaximo: real('stock_maximo'),
    pesable: integer('pesable', { mode: 'boolean' }).notNull().default(false),
    activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
    updatedAt: text('updated_at').notNull().default("(datetime('now','localtime'))"),
  },
  (t) => ({
    idxBarcode: index('idx_productos_barcode').on(t.codigoBarras),
    idxNombre: index('idx_productos_nombre').on(t.nombre),
    idxNegocio: index('idx_productos_negocio').on(t.negocioId),
  })
)

export const cajas = sqliteTable('cajas', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sucursalId: integer('sucursal_id').notNull().references(() => sucursales.id),
  nombre: text('nombre').notNull(),
})

export const turnosCaja = sqliteTable('turnos_caja', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  cajaId: integer('caja_id').notNull().references(() => cajas.id),
  usuarioId: integer('usuario_id').notNull().references(() => usuarios.id),
  aperturaAt: text('apertura_at').notNull().default("(datetime('now','localtime'))"),
  cierreAt: text('cierre_at'),
  montoApertura: real('monto_apertura').notNull().default(0),
  montoCierreDeclado: real('monto_cierre_declado'),
  montoCierreSistema: real('monto_cierre_sistema'),
  diferencia: real('diferencia'),
  estado: text('estado', { enum: ['abierto', 'cerrado'] }).notNull().default('abierto'),
})

export const clientes = sqliteTable('clientes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  negocioId: integer('negocio_id').notNull().references(() => negocios.id),
  nombre: text('nombre').notNull(),
  cuitDni: text('cuit_dni'),
  telefono: text('telefono'),
  email: text('email'),
  condicionAfip: text('condicion_afip'),
  saldoCuentaCorriente: real('saldo_cuenta_corriente').notNull().default(0),
})

export const ventas = sqliteTable(
  'ventas',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    turnoId: integer('turno_id').notNull().references(() => turnosCaja.id),
    sucursalId: integer('sucursal_id').notNull().references(() => sucursales.id),
    usuarioId: integer('usuario_id').notNull().references(() => usuarios.id),
    clienteId: integer('cliente_id').references(() => clientes.id),
    fecha: text('fecha').notNull().default("(datetime('now','localtime'))"),
    subtotal: real('subtotal').notNull().default(0),
    descuentoTotal: real('descuento_total').notNull().default(0),
    total: real('total').notNull().default(0),
    estado: text('estado', { enum: ['completada', 'anulada', 'devuelta'] }).notNull().default('completada'),
    tipoComprobante: text('tipo_comprobante', {
      enum: ['ticket', 'factura_a', 'factura_b', 'factura_c', 'presupuesto'],
    }).notNull().default('ticket'),
    cae: text('cae'),
    caeVencimiento: text('cae_vencimiento'),
    numeroComprobante: text('numero_comprobante'),
  },
  (t) => ({
    idxTurno: index('idx_ventas_turno').on(t.turnoId),
    idxFecha: index('idx_ventas_fecha').on(t.fecha),
  })
)

export const itemsVenta = sqliteTable('items_venta', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ventaId: integer('venta_id').notNull().references(() => ventas.id),
  productoId: integer('producto_id').notNull().references(() => productos.id),
  cantidad: real('cantidad').notNull(),
  precioUnitario: real('precio_unitario').notNull(),
  descuento: real('descuento').notNull().default(0),
  subtotal: real('subtotal').notNull(),
  pesable: integer('pesable', { mode: 'boolean' }).notNull().default(false),
})

export const pagosVenta = sqliteTable('pagos_venta', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ventaId: integer('venta_id').notNull().references(() => ventas.id),
  medioPago: text('medio_pago', {
    enum: ['efectivo', 'debito', 'credito', 'qr_mp', 'transferencia', 'cuenta_corriente'],
  }).notNull(),
  monto: real('monto').notNull(),
  referencia: text('referencia'),
})

export const movimientosStock = sqliteTable(
  'movimientos_stock',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    productoId: integer('producto_id').notNull().references(() => productos.id),
    tipo: text('tipo', {
      enum: ['entrada', 'salida', 'ajuste', 'transferencia', 'devolucion'],
    }).notNull(),
    cantidad: real('cantidad').notNull(),
    cantidadAnterior: real('cantidad_anterior').notNull(),
    motivo: text('motivo'),
    referenciaId: integer('referencia_id'),
    referenciaTipo: text('referencia_tipo'),
    usuarioId: integer('usuario_id').references(() => usuarios.id),
    fecha: text('fecha').notNull().default("(datetime('now','localtime'))"),
  },
  (t) => ({
    idxProducto: index('idx_movstock_producto').on(t.productoId),
    idxFecha: index('idx_movstock_fecha').on(t.fecha),
  })
)

export const proveedores = sqliteTable('proveedores', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  negocioId: integer('negocio_id').notNull().references(() => negocios.id),
  nombre: text('nombre').notNull(),
  cuit: text('cuit'),
  telefono: text('telefono'),
  email: text('email'),
  condicionPago: text('condicion_pago'),
})

export const productosProveedores = sqliteTable(
  'productos_proveedores',
  {
    productoId: integer('producto_id').notNull().references(() => productos.id),
    proveedorId: integer('proveedor_id').notNull().references(() => proveedores.id),
    codigoProveedor: text('codigo_proveedor'),
    precioProveedor: real('precio_proveedor'),
  },
  (t) => ({
    idxUnique: uniqueIndex('idx_prod_prov_unique').on(t.productoId, t.proveedorId),
  })
)

export const compras = sqliteTable('compras', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  proveedorId: integer('proveedor_id').notNull().references(() => proveedores.id),
  usuarioId: integer('usuario_id').notNull().references(() => usuarios.id),
  fecha: text('fecha').notNull().default("(datetime('now','localtime'))"),
  total: real('total').notNull().default(0),
  estado: text('estado', { enum: ['pendiente', 'recibida', 'cancelada'] }).notNull().default('pendiente'),
})

export const itemsCompra = sqliteTable('items_compra', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  compraId: integer('compra_id').notNull().references(() => compras.id),
  productoId: integer('producto_id').notNull().references(() => productos.id),
  cantidad: real('cantidad').notNull(),
  precioUnitario: real('precio_unitario').notNull(),
  subtotal: real('subtotal').notNull(),
})

export const configuracion = sqliteTable(
  'configuracion',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    negocioId: integer('negocio_id').notNull().references(() => negocios.id),
    clave: text('clave').notNull(),
    valor: text('valor').notNull(),
  },
  (t) => ({
    idxUnique: uniqueIndex('idx_config_negocio_clave').on(t.negocioId, t.clave),
  })
)

export const auditLog = sqliteTable('audit_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  usuarioId: integer('usuario_id').references(() => usuarios.id),
  accion: text('accion').notNull(),
  tabla: text('tabla'),
  referenciaId: integer('referencia_id'),
  detalle: text('detalle'),
  fecha: text('fecha').notNull().default("(datetime('now','localtime'))"),
})
