import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import * as schema from './schema'

let _db: ReturnType<typeof drizzle> | null = null
let _sqlite: Database.Database | null = null

function getDbPath(): string {
  const userDataPath = app.getPath('userData')
  return join(userDataPath, 'sistema-pos.db')
}

export function initDatabase(): void {
  const dbPath = getDbPath()
  _sqlite = new Database(dbPath)

  // WAL mode for better concurrent performance and crash safety
  _sqlite.pragma('journal_mode = WAL')
  _sqlite.pragma('foreign_keys = ON')
  _sqlite.pragma('synchronous = NORMAL')

  _db = drizzle(_sqlite, { schema })

  runMigrations()
  runIncrementalMigrations()
  seedInitialData()
}

function runMigrations(): void {
  if (!_sqlite) throw new Error('Database not initialized')

  // Run inline migrations via SQL (simpler than Drizzle Kit for Electron)
  _sqlite.exec(`
    CREATE TABLE IF NOT EXISTS negocios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      razon_social TEXT NOT NULL,
      cuit TEXT NOT NULL,
      condicion_afip TEXT NOT NULL DEFAULT 'monotributo',
      domicilio TEXT NOT NULL DEFAULT '',
      telefono TEXT NOT NULL DEFAULT '',
      logo_path TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS modulos_activos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      negocio_id INTEGER NOT NULL REFERENCES negocios(id),
      modulo_key TEXT NOT NULL,
      activo INTEGER NOT NULL DEFAULT 1,
      activado_en TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS sucursales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      negocio_id INTEGER NOT NULL REFERENCES negocios(id),
      nombre TEXT NOT NULL,
      domicilio TEXT NOT NULL DEFAULT '',
      activa INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      negocio_id INTEGER NOT NULL REFERENCES negocios(id),
      nombre TEXT NOT NULL,
      pin TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'cajero',
      activo INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS categorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      negocio_id INTEGER NOT NULL REFERENCES negocios(id),
      nombre TEXT NOT NULL,
      categoria_padre_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      negocio_id INTEGER NOT NULL REFERENCES negocios(id),
      codigo_barras TEXT,
      codigo_interno TEXT,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      categoria_id INTEGER REFERENCES categorias(id),
      unidad_medida TEXT NOT NULL DEFAULT 'unidad',
      precio_costo REAL NOT NULL DEFAULT 0,
      precio_venta REAL NOT NULL DEFAULT 0,
      precio_mayorista REAL,
      stock_actual REAL NOT NULL DEFAULT 0,
      stock_minimo REAL NOT NULL DEFAULT 0,
      stock_maximo REAL,
      pesable INTEGER NOT NULL DEFAULT 0,
      activo INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_productos_barcode ON productos(codigo_barras);
    CREATE INDEX IF NOT EXISTS idx_productos_nombre ON productos(nombre);
    CREATE INDEX IF NOT EXISTS idx_productos_negocio ON productos(negocio_id);

    CREATE TABLE IF NOT EXISTS cajas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sucursal_id INTEGER NOT NULL REFERENCES sucursales(id),
      nombre TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS turnos_caja (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      caja_id INTEGER NOT NULL REFERENCES cajas(id),
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
      apertura_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      cierre_at TEXT,
      monto_apertura REAL NOT NULL DEFAULT 0,
      monto_cierre_declado REAL,
      monto_cierre_sistema REAL,
      diferencia REAL,
      estado TEXT NOT NULL DEFAULT 'abierto'
    );

    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      negocio_id INTEGER NOT NULL REFERENCES negocios(id),
      nombre TEXT NOT NULL,
      cuit_dni TEXT,
      telefono TEXT,
      email TEXT,
      condicion_afip TEXT,
      saldo_cuenta_corriente REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ventas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      turno_id INTEGER NOT NULL REFERENCES turnos_caja(id),
      sucursal_id INTEGER NOT NULL REFERENCES sucursales(id),
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
      cliente_id INTEGER REFERENCES clientes(id),
      fecha TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      subtotal REAL NOT NULL DEFAULT 0,
      descuento_total REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      estado TEXT NOT NULL DEFAULT 'completada',
      tipo_comprobante TEXT NOT NULL DEFAULT 'ticket',
      cae TEXT,
      cae_vencimiento TEXT,
      numero_comprobante TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_ventas_turno ON ventas(turno_id);
    CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha);

    CREATE TABLE IF NOT EXISTS items_venta (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id INTEGER NOT NULL REFERENCES ventas(id),
      producto_id INTEGER NOT NULL REFERENCES productos(id),
      cantidad REAL NOT NULL,
      precio_unitario REAL NOT NULL,
      descuento REAL NOT NULL DEFAULT 0,
      subtotal REAL NOT NULL,
      pesable INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS pagos_venta (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id INTEGER NOT NULL REFERENCES ventas(id),
      medio_pago TEXT NOT NULL,
      monto REAL NOT NULL,
      referencia TEXT
    );

    CREATE TABLE IF NOT EXISTS movimientos_stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER NOT NULL REFERENCES productos(id),
      tipo TEXT NOT NULL,
      cantidad REAL NOT NULL,
      cantidad_anterior REAL NOT NULL,
      motivo TEXT,
      referencia_id INTEGER,
      referencia_tipo TEXT,
      usuario_id INTEGER REFERENCES usuarios(id),
      fecha TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_movstock_producto ON movimientos_stock(producto_id);
    CREATE INDEX IF NOT EXISTS idx_movstock_fecha ON movimientos_stock(fecha);

    CREATE TABLE IF NOT EXISTS proveedores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      negocio_id INTEGER NOT NULL REFERENCES negocios(id),
      nombre TEXT NOT NULL,
      cuit TEXT,
      telefono TEXT,
      email TEXT,
      condicion_pago TEXT
    );

    CREATE TABLE IF NOT EXISTS productos_proveedores (
      producto_id INTEGER NOT NULL REFERENCES productos(id),
      proveedor_id INTEGER NOT NULL REFERENCES proveedores(id),
      codigo_proveedor TEXT,
      precio_proveedor REAL,
      PRIMARY KEY (producto_id, proveedor_id)
    );

    CREATE TABLE IF NOT EXISTS compras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proveedor_id INTEGER NOT NULL REFERENCES proveedores(id),
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
      fecha TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      total REAL NOT NULL DEFAULT 0,
      estado TEXT NOT NULL DEFAULT 'pendiente'
    );

    CREATE TABLE IF NOT EXISTS items_compra (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      compra_id INTEGER NOT NULL REFERENCES compras(id),
      producto_id INTEGER NOT NULL REFERENCES productos(id),
      cantidad REAL NOT NULL,
      precio_unitario REAL NOT NULL,
      subtotal REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS configuracion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      negocio_id INTEGER NOT NULL REFERENCES negocios(id),
      clave TEXT NOT NULL,
      valor TEXT NOT NULL,
      UNIQUE(negocio_id, clave)
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER REFERENCES usuarios(id),
      accion TEXT NOT NULL,
      tabla TEXT,
      referencia_id INTEGER,
      detalle TEXT,
      fecha TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS cobranzas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL REFERENCES clientes(id),
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
      monto REAL NOT NULL,
      medio_pago TEXT NOT NULL DEFAULT 'efectivo',
      observacion TEXT,
      fecha TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
  `)
}

function runIncrementalMigrations(): void {
  if (!_sqlite) return
  // ALTER TABLE only if column doesn't exist (SQLite workaround)
  const alterIfMissing = (table: string, column: string, definition: string) => {
    const cols = (_sqlite!.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(c => c.name)
    if (!cols.includes(column)) {
      _sqlite!.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
    }
  }
  alterIfMissing('clientes', 'activo', 'INTEGER NOT NULL DEFAULT 1')
  alterIfMissing('clientes', 'limite_credito', 'REAL NOT NULL DEFAULT 0')
  alterIfMissing('proveedores', 'activo', 'INTEGER NOT NULL DEFAULT 1')
}

function seedInitialData(): void {
  if (!_sqlite) return

  const negocioCount = _sqlite.prepare('SELECT COUNT(*) as c FROM negocios').get() as { c: number }
  if (negocioCount.c > 0) return

  // Insert default negocio, sucursal, caja, and admin user
  const negocioStmt = _sqlite.prepare(`
    INSERT INTO negocios (nombre, razon_social, cuit, condicion_afip)
    VALUES ('Mi Comercio', 'Mi Comercio S.R.L.', '00-00000000-0', 'monotributo')
  `)
  const negocioResult = negocioStmt.run()
  const negocioId = negocioResult.lastInsertRowid as number

  const sucursalStmt = _sqlite.prepare(`
    INSERT INTO sucursales (negocio_id, nombre) VALUES (?, 'Casa Central')
  `)
  const sucursalResult = sucursalStmt.run(negocioId)
  const sucursalId = sucursalResult.lastInsertRowid as number

  _sqlite.prepare(`
    INSERT INTO cajas (sucursal_id, nombre) VALUES (?, 'Caja 1')
  `).run(sucursalId)

  _sqlite.prepare(`
    INSERT INTO usuarios (negocio_id, nombre, pin, rol)
    VALUES (?, 'Administrador', '1234', 'admin')
  `).run(negocioId)
}

export function getDb(): ReturnType<typeof drizzle> {
  if (!_db) throw new Error('Database not initialized. Call initDatabase() first.')
  return _db
}

export function getSqlite(): Database.Database {
  if (!_sqlite) throw new Error('Database not initialized. Call initDatabase() first.')
  return _sqlite
}
