# Sistema POS — Roadmap

## Estado actual: Phase 2 (parcial) ✅

### Para arrancar en otra máquina

```bash
git clone https://github.com/equazin/Sistema.git
cd Sistema
npm install --ignore-scripts
```

**Descargar Electron (obligatorio):**
1. Ir a https://github.com/electron/electron/releases/tag/v34.5.8
2. Bajar `electron-v34.5.8-win32-x64.zip`
3. Extraer el contenido en `node_modules/electron/dist/`
   - Debe quedar `node_modules/electron/dist/electron.exe` (~180 MB)

**Instalar prebuild de better-sqlite3 para Electron 34:**
```bash
cd node_modules/better-sqlite3
npx prebuild-install --runtime electron --target 34.5.8 --arch x64 --platform win32
cd ../..
```

```bash
npm run dev   # abre la app
```

**Credenciales por defecto:** usuario `admin`, PIN `1234`

---

## Phase 1 MVP ✅ (completo)

- Login con PIN
- Punto de venta: búsqueda de productos, carrito, cobro multi-medio
- Gestión de productos y categorías (CRUD)
- Control de stock con historial de movimientos
- Apertura y cierre de caja con resumen de ventas
- Configuración del negocio

---

## Phase 2 — Features Comerciales

### 2.1 Impresión de Tickets ✅
- Ticket de venta: negocio, items, totales, medios de pago, fecha/hora, nro venta
- Ticket de cierre de caja: resumen por medio de pago, diferencia de efectivo
- Botón imprimir post-venta y post-cierre
- Impresión HTML via BrowserWindow (80mm, sin librerías nativas)
- **Pendiente:** config IP/COM impresora térmica, preview en pantalla, 58mm

### 2.2 Facturación AFIP/ARCA (Alta prioridad) ⏳
- Integrar webservice WSFE (Factura Electrónica)
- Certificado digital: generar CSR, subir a ARCA, guardar .crt + .key en userData
- Tipos de comprobante: Ticket (sin datos comprador), FC-A, FC-B, NC-B
- CAE online + fallback offline (CAE diferido)
- Almacenar CAE, vencimiento, nro comprobante en tabla `comprobantes`
- QR ARCA en ticket impreso

### 2.3 MercadoPago QR Dinámico ⏳
- Crear orden de pago vía MP API cuando medio pago = `qr_mp`
- Polling cada 2 seg hasta confirmar (`approved`) o timeout 120 seg
- Credenciales MP en Config (access_token por negocio)
- Mostrar QR en pantalla para el cliente

### 2.4 Módulo Proveedores y Compras ✅
- ABM proveedores (nombre, CUIT, teléfono, email, condición pago)
- Órdenes de compra: seleccionar proveedor + items + cantidades + precio costo
- Recepción de mercadería: confirmar OC → incrementa stock + movimientos_stock
- Historial de órdenes de compra con detalle
- **Pendiente:** alerta de stock mínimo con sugerencia de reorden

### 2.5 Módulo Clientes y Cuentas Corrientes ✅
- ABM clientes (nombre, DNI/CUIT, teléfono, email, condición AFIP, límite crédito)
- Estado de cuenta: ventas en CC, cobranzas, saldo actual
- Cobranza parcial o total con múltiples medios de pago
- **Pendiente:** medio de pago `cuenta_corriente` integrado en POS al cobrar

### 2.6 Promociones y Descuentos ⏳
- Descuentos por producto (precio especial con fecha de vigencia)
- Descuentos por categoría (ej: 10% en bebidas hasta el 30/4)
- Descuentos por medio de pago (ej: 5% con débito)
- Código de descuento manual (cajero ingresa %)
- 2x1 / 3x2 configurables

### 2.7 Actualización Masiva de Precios ⏳
- Aumentar por porcentaje (todos los productos o por categoría/proveedor)
- Importar precios desde CSV (codigoBarras + nuevoPrecio)
- Preview con diferencias antes de aplicar
- Historial de actualizaciones de precios

### 2.8 Reportes y Exportación ✅
- Ventas agrupadas por día / semana / mes con resumen y detalle
- Ranking de productos más vendidos (top 20)
- Desglose por medio de pago con porcentajes
- Stock valorizado (costo × stockActual y venta × stockActual), alertas bajo mínimo
- Exportar CSV desde cualquier vista
- **Pendiente:** gráficos de línea (recharts), exportar Excel (.xlsx)

### 2.9 Usuarios y Permisos ✅
- Roles: `admin`, `encargado`, `cajero`, `lectura`
- Crear / editar / desactivar usuarios con PIN
- Protección: no se puede eliminar el último admin
- Módulo visible solo para rol `admin`
- **Pendiente:** permisos granulares (puede_hacer_descuentos, etc.), log de auditoría, cambio de turno

---

## Phase 3 — Expansión

### 3.1 REST API Local (Electron main process)
- Levantar Express en puerto configurable (default 3001)
- Endpoints: `/ventas`, `/productos`, `/stock`, `/caja`
- Autenticación JWT por API key de negocio
- Permite integración con básculas, balanzas, sistemas externos

### 3.2 App Mobile (React Native + Expo)
- Dashboard: ventas del día, alertas de stock, estado de caja
- Notificaciones push: stock bajo, venta grande, caja abierta/cerrada
- Consulta de precios (cámara → barcode → precio)
- Pedido a proveedor desde el celular
- Conecta al REST API local vía WiFi local o Tailscale

### 3.3 Multisucursal
- Sincronización de catálogo entre sucursales (maestro → réplicas)
- Reportes consolidados
- Transferencia de stock entre sucursales
- Dashboard central en la nube (Supabase)

### 3.4 Infraestructura
- Módulos activables por plan (Básico / Pro / Enterprise)
- Backup automático diario a carpeta configurable + Google Drive opcional
- Auto-update: electron-updater con release en GitHub
- Instalador NSIS para Windows (electron-builder)

---

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Desktop | Electron 34.5.8 |
| UI | React 18 + Tailwind CSS |
| Estado | Zustand v5 |
| DB | SQLite (better-sqlite3 v12) + Drizzle ORM |
| Build | electron-vite v5 + Vite 5 |
| Lang | TypeScript strict |

## Notas de compatibilidad

- **Electron**: usar v34.x. Electron 41+ tiene un conflicto de resolución de módulos con `node_modules/electron` en Windows que impide arrancar en dev. Downgrade a 34 resuelve el problema.
- **better-sqlite3**: usar v12+ (tiene prebuilds para Electron 33+). Correr `prebuild-install --target 34.5.8` manualmente porque el postinstall puede fallar por el stack overflow del postinstall de Electron.
- **electron-vite**: v5.0 es compatible con Electron 34 y Vite 5. NO usar electron-vite@2.3 con Electron 34+.
- **npm install**: usar `--ignore-scripts` para evitar el crash del postinstall de better-sqlite3 en entornos sin MSVC. Luego correr prebuild-install manualmente.
- **Drizzle schema indexes**: la sintaxis es `(t) => ({ key: index(...).on(t.col) })` — retorna objeto, no array.
- **Electron binary**: descargar de GitHub releases. El cache local de Electron puede tener versiones incorrectas — siempre verificar con `ProductVersion` en las propiedades del exe.
