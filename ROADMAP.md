# Sistema POS - Roadmap

## Estado actual: Phase 2 (cierre comercial, sin ARCA)

ARCA/AFIP queda fuera del camino critico por ahora. La prioridad es cerrar el flujo comercial local: POS, caja, stock, clientes, proveedores, reportes, backups, actualizaciones e impresion.

### Para arrancar en otra maquina

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
npm run dev
```

**Credenciales por defecto:** usuario `admin`, PIN `1234`

---

## Phase 1 - MVP completo

- Login con PIN.
- Punto de venta: busqueda de productos, carrito y cobro multi-medio.
- Gestion de productos y categorias.
- Control de stock con historial de movimientos.
- Apertura y cierre de caja con resumen de ventas.
- Configuracion del negocio.

---

## Phase 2 - Cierre comercial antes de ARCA

### 2.1 Base comercial implementada

- Impresion de ticket de venta y ticket de cierre desde HTML via BrowserWindow.
- ABM productos y categorias.
- ABM clientes, estado de cuenta y cobranzas.
- ABM proveedores, ordenes de compra y recepcion de mercaderia.
- Reportes de ventas, ranking, medios de pago y stock valorizado.
- Exportacion CSV y exportacion Excel basica.
- Usuarios con roles `admin`, `encargado`, `cajero`, `lectura`.
- MercadoPago QR dinamico con credenciales en Configuracion, creacion de orden, QR en pantalla, polling y cancelacion.
- Promociones por producto, categoria, medio de pago, monto fijo, 2x1 y 3x2.
- Actualizacion masiva de precios por porcentaje o CSV, con preview y registro en `audit_log`.
- Backup manual y automatico con carpeta configurable.
- Auto-update con `electron-updater`.
- Instalador NSIS configurado con `electron-builder`.
- Vista previa de tickets de venta/cierre.
- Configuracion de ancho de ticket 58mm/80mm.
- Selector de impresora instalada desde Configuracion.
- Sugerencias de reorden desde productos bajo minimo.
- Exportacion `.xlsx` real desde reportes.
- Auditoria reciente visible para administradores.
- Matriz de permisos por rol aplicada en navegacion y validaciones backend sensibles.
- `schema.ts` sincronizado con tablas adicionales de SQLite.
- README principal del proyecto.

### 2.2 Cuenta corriente integrada al POS - implementado base

- Selector de cliente desde el POS.
- Medio de pago `cuenta_corriente` visible en cobro.
- Validacion de limite de credito en UI y backend.
- Venta asociada al cliente seleccionado.
- Actualizacion de `saldo_cuenta_corriente` al cerrar una venta en cuenta corriente.
- Saldo y limite disponible visibles durante el cobro.
- Test unitario de reglas de cuenta corriente.
- Test de integracion con SQLite real para venta por cuenta corriente.

### 2.3 Impresion - implementado base

- Preview en pantalla antes de imprimir.
- Soporte 58mm ademas de 80mm.
- Preferencia de ancho guardada en configuracion.
- Campo de impresora preferida para usar `deviceName` si se conoce el nombre exacto.
- Selector/listado de impresoras instaladas.
- **Pendiente:** definir si se usara impresion por IP o COM/USB directo.

### 2.4 Proveedores, compras y stock - implementado base

- Alertas de stock minimo con sugerencia de reorden.
- Sugerir proveedor habitual cuando existe relacion `productos_proveedores`.
- Sugerir cantidad a comprar hasta stock minimo o maximo.
- Generar orden de compra desde productos bajo minimo.
- Filtrar productos bajo minimo por categoria/proveedor.

### 2.5 Reportes - implementado base

- Exportacion `.xlsx` real.
- Graficos de ventas por dia/semana/mes.
- Grafico por medio de pago.
- Filtros adicionales por usuario, caja y cliente.
- Reporte de cuenta corriente por cliente.

### 2.6 Usuarios, permisos y auditoria - implementado base

- Permisos granulares por accion con matriz por rol y bloqueo de navegacion no permitida.
- Validaciones backend para cierre/apertura de caja, stock, compras y actualizacion de precios.
- Vista de auditoria para cambios sensibles.
- Registro de eventos de ventas y usuarios en `audit_log`.
- Registro de auditoria en caja, stock y compras.
- Registro de auditoria en clientes, cobranzas y productos con usuario de la accion.
- Cambio de turno/cajero sin reiniciar la app.

### 2.7 Calidad tecnica antes de cerrar Phase 2

- `src/main/db/schema.ts` sincronizado con las tablas creadas en `src/main/db/database.ts`.
- Revisar migraciones/alteraciones incrementales de SQLite.
- Corregir textos con caracteres rotos en la UI si aparecen al ejecutar.
- Agregar pruebas para venta, caja, stock, promociones, cuenta corriente, backup y precios masivos.
- Documentar ubicacion real de la base SQLite y estrategia de backup/restore.
- README principal del proyecto con instalacion, scripts, credenciales y troubleshooting.

---

## Phase 3 - Expansion local y operativa

### 3.1 REST API local

- Levantar servidor local en puerto configurable.
- Endpoints para `/ventas`, `/productos`, `/stock`, `/caja`, `/clientes`.
- Autenticacion por API key.
- Integracion con balanzas, lectores, sistemas externos y app mobile.

### 3.2 App mobile

- Dashboard: ventas del dia, alertas de stock y estado de caja.
- Notificaciones: stock bajo, venta grande, caja abierta/cerrada.
- Consulta de precios con camara/barcode.
- Pedido a proveedor desde el celular.
- Conexion via WiFi local, Tailscale o API local.

### 3.3 Multisucursal

- Sincronizacion de catalogo entre sucursales.
- Reportes consolidados.
- Transferencias de stock entre sucursales.
- Dashboard central en la nube.

### 3.4 Infraestructura comercial

- Modulos activables por plan.
- Backup automatico a Google Drive u otro destino externo.
- Publicacion de releases en GitHub para auto-update.
- Firma de instaladores si se distribuye a clientes.

---

## Phase 4 - ARCA/AFIP al final

### 4.1 Facturacion electronica

- Integrar webservice WSFE.
- Generar CSR y gestionar certificado digital.
- Guardar `.crt` y `.key` en `userData` o almacen seguro.
- Configurar punto de venta fiscal.
- Emitir FC-A, FC-B, FC-C, NC y comprobantes segun condicion fiscal.
- Obtener CAE online.
- Definir fallback offline/contingencia.
- Almacenar CAE, vencimiento y numero de comprobante en tabla `comprobantes`.
- Agregar QR ARCA al ticket impreso.
- Reportar errores fiscales con mensajes accionables para el usuario.

---

## Stack tecnico

| Capa | Tecnologia |
|------|------------|
| Desktop | Electron 34.5.8 |
| UI | React 18 + Tailwind CSS |
| Estado | Zustand v5 |
| DB | SQLite (better-sqlite3 v12) + Drizzle ORM |
| Build | electron-vite v5 + Vite 5 |
| Lang | TypeScript strict |

## Notas de compatibilidad

- **Electron**: usar v34.x. Electron 41+ tiene un conflicto de resolucion de modulos con `node_modules/electron` en Windows que impide arrancar en dev.
- **better-sqlite3**: usar v12+. Correr `prebuild-install --target 34.5.8` manualmente si el postinstall falla.
- **electron-vite**: v5.0 es compatible con Electron 34 y Vite 5.
- **npm install**: usar `--ignore-scripts` para evitar fallos del postinstall en entornos sin MSVC; luego instalar el prebuild manual.
- **Drizzle schema indexes**: la sintaxis es `(t) => ({ key: index(...).on(t.col) })`, retorna objeto, no array.
- **Electron binary**: descargar de GitHub releases si el cache local trae una version incorrecta.
