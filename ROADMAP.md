# Sistema POS — Roadmap

## Estado actual: Phase 1 MVP ✅

### Para arrancar en otra máquina

```bash
git clone https://github.com/nicopbenitez84/Sistema.git
cd Sistema
npm install
```

**Descargar Electron (obligatorio):**
1. Ir a https://github.com/electron/electron/releases/tag/v34.5.2
2. Bajar `electron-v34.5.2-win32-x64.zip`
3. Extraer el contenido en `node_modules/electron/dist/`
   - Debe quedar `node_modules/electron/dist/electron.exe` (Chromium real, ~200 MB)

```bash
npm run dev   # abre la app
```

**Credenciales por defecto:** usuario `admin`, PIN `1234`

---

## Phase 2 — Features Comerciales

### 2.1 Impresión de Tickets (Alta prioridad)
- Integrar `node-thermal-printer` o `escpos` para impresoras térmicas (Epson TM-T20, etc.)
- Ticket de venta: logo negocio, items, totales, medio de pago, vuelto, fecha/hora, nro venta
- Ticket de cierre de caja: resumen por medio de pago, total
- Preview en pantalla antes de imprimir
- Config: IP/COM de impresora, ancho de papel (58mm / 80mm)

### 2.2 Facturación AFIP/ARCA (Alta prioridad)
- Integrar webservice WSFE (Factura Electrónica)
- Certificado digital: generar CSR, subir a ARCA, guardar .crt + .key en userData
- Tipos de comprobante: Ticket (sin datos comprador), FC-A, FC-B, NC-B
- CAE online + fallback offline (CAE diferido)
- Almacenar CAE, vencimiento, nro comprobante en tabla `comprobantes`
- QR ARCA en ticket impreso

### 2.3 MercadoPago QR Dinámico
- Crear orden de pago vía MP API cuando medio pago = `qr_mp`
- Polling cada 2 seg hasta confirmar (`approved`) o timeout 120 seg
- Credenciales MP en Config (access_token por negocio)
- Mostrar QR en pantalla para el cliente

### 2.4 Módulo Proveedores y Compras
- ABM proveedores (nombre, CUIT, teléfono, email, condición IVA)
- Órdenes de compra: seleccionar proveedor + items + cantidades + precio costo
- Recepción de mercadería: confirmar OC → incrementa stock automáticamente
- Historial de compras por proveedor
- Alerta de stock mínimo con sugerencia de reorden

### 2.5 Módulo Clientes y Cuentas Corrientes
- ABM clientes (nombre, DNI/CUIT, teléfono, límite de crédito)
- Medio de pago adicional: `cuenta_corriente`
- Registro de deuda por cliente
- Cobranza parcial o total
- Estado de cuenta (movimientos, saldo actual)

### 2.6 Promociones y Descuentos
- Descuentos por producto (precio especial con fecha de vigencia)
- Descuentos por categoría (ej: 10% en bebidas hasta el 30/4)
- Descuentos por medio de pago (ej: 5% con débito)
- Código de descuento manual (cajero ingresa %)
- 2x1 / 3x2 configurables

### 2.7 Actualización Masiva de Precios
- Aumentar por porcentaje (todos los productos o por categoría/proveedor)
- Importar precios desde Excel/CSV (codigoBarras + nuevoPrecio)
- Preview con diferencias antes de aplicar
- Historial de actualizaciones de precios

### 2.8 Reportes y Exportación
- Ventas del día / semana / mes (agrupadas por categoría, producto, vendedor)
- Ranking de productos más vendidos
- Reporte de stock valorizado (costo × stockActual)
- Exportar a Excel/CSV (`xlsx` npm package)
- Gráficos de línea con recharts (ventas por hora/día)

### 2.9 Usuarios y Permisos
- Roles: `admin`, `cajero`, `supervisor`
- Permisos granulares: puede_hacer_descuentos, puede_anular_venta, puede_ver_reportes
- Log de acciones por usuario (auditoría)
- Cambio de turno: cierre de caja parcial sin cerrar el día

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
| Desktop | Electron 41 |
| UI | React 18 + Tailwind CSS |
| Estado | Zustand v5 |
| DB | SQLite (better-sqlite3 v12) + Drizzle ORM |
| Build | electron-vite + Vite 5 |
| Lang | TypeScript strict |

## Notas de compatibilidad

- **better-sqlite3**: usar v12+ (tiene prebuilds para Electron 33+). El postinstall en package.json usa `prebuild-install` para bajar el binario nativo sin MSVC.
- **Vite**: electron-vite@2.3 require Vite ^5 o ^6. NO actualizar a Vite 8.
- **Drizzle schema indexes**: la sintaxis es `(t) => ({ key: index(...).on(t.col) })` — retorna objeto, no array.
- **Electron binary**: descargar de GitHub releases, no del npm cache que puede estar corrupto.
