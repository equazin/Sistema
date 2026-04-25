# Sistema POS

Sistema POS de escritorio para comercios argentinos (kioscos, minimercados, almacenes). Electron + React + SQLite. Sin dependencia de servicios externos para el flujo principal.

## Funcionalidades

- **Punto de venta** — búsqueda por código de barras o nombre, carrito, cobro multi-medio (efectivo, débito, crédito, transferencia, QR MercadoPago, cuenta corriente), promociones automáticas
- **Caja** — apertura y cierre de turno con monto declarado vs sistema, ticket de cierre, cambio de cajero sin reiniciar la app
- **Productos y stock** — ABM completo, ajustes manuales, historial de movimientos, alertas de stock mínimo, actualización masiva de precios (% o CSV)
- **Clientes** — cuenta corriente, límite de crédito, cobranzas, estado de cuenta
- **Proveedores** — órdenes de compra, recepción de mercadería, sugerencias de reorden
- **Promociones** — porcentaje por producto/categoría/medio de pago, 2x1, 3x2, monto fijo
- **Reportes** — ventas (con gráfico), ranking de productos, medios de pago, stock valorizado, cuenta corriente — exporta CSV y XLSX
- **Impresión** — ticket de venta y cierre de caja, soporte 58mm/80mm, selección de impresora instalada
- **Backup** — manual y automático (diario/semanal), carpeta configurable, historial de 30 archivos
- **Auto-update** — via `electron-updater` apuntando a GitHub Releases
- **Auditoría** — registro de acciones sensibles por usuario
- **Usuarios y roles** — admin, encargado, cajero, solo lectura — permisos aplicados en UI y backend
- **MercadoPago QR** — integración nativa (sin SDK externo), polling de estado, cancelación automática

## Requisitos

- Node compatible con el proyecto instalado localmente.
- Electron 34.5.8.
- Windows x64 para el flujo documentado.

## Instalacion

```bash
git clone https://github.com/equazin/Sistema.git
cd Sistema
npm install --ignore-scripts
```

Descargar Electron:

1. Ir a https://github.com/electron/electron/releases/tag/v34.5.8
2. Descargar `electron-v34.5.8-win32-x64.zip`.
3. Extraerlo en `node_modules/electron/dist/`.
4. Verificar que exista `node_modules/electron/dist/electron.exe`.

Preparar `better-sqlite3` para Electron:

```bash
npm run sqlite:electron
```

## Desarrollo

```bash
npm run dev
```

Credenciales iniciales:

- Usuario: `admin`
- PIN: `1234`

## Scripts

```bash
npm run dev             # prepara better-sqlite3 para Electron y abre la app
npm run build           # compila main, preload y renderer
npm run preview         # prepara better-sqlite3 para Electron y abre preview
npm run package         # build + prepara Electron + electron-builder
npm run typecheck       # TypeScript sin emitir archivos
npm test -- --run       # prepara better-sqlite3 para Node y corre Vitest
npm run sqlite:node     # cambia better-sqlite3 al runtime Node
npm run sqlite:electron # cambia better-sqlite3 al runtime Electron
```

## Nota sobre better-sqlite3

`better-sqlite3` usa un binario nativo distinto para Node y Electron. Por eso:

- `npm test` prepara automaticamente el binario para Node.
- `npm run dev`, `preview`, `package` y `postinstall` preparan automaticamente el binario para Electron.

Si aparece un error de `NODE_MODULE_VERSION`, ejecutar el script del runtime que corresponda:

```bash
npm run sqlite:node
npm run sqlite:electron
```

## Base de datos

La base SQLite se guarda en `%APPDATA%\sistema-pos\sistema-pos.db` (Windows). La app usa WAL mode.

Los backups se configuran desde Configuración → Backup. Por defecto en `%APPDATA%\sistema-pos\backups\`. Se conservan los últimos 30 archivos.

Para restaurar: cerrar la app, reemplazar `sistema-pos.db` con un archivo `backup-*.db`.

## Estructura del proyecto

```
src/
├── main/           # Proceso principal Electron
│   ├── db/         # Schema SQLite, inicialización y migraciones
│   └── ipc/        # Handlers IPC (uno por dominio)
├── preload/        # Bridge contextIsolation → renderer
├── renderer/       # App React
│   ├── components/ # Componentes UI reutilizables
│   ├── pages/      # Páginas principales
│   ├── stores/     # Estado global (Zustand)
│   └── lib/        # Helpers (api, format)
└── shared/         # Tipos y contratos IPC compartidos
    ├── types.ts
    ├── ipc-channels.ts
    └── permissions.ts
tests/              # Tests unitarios e integración (Vitest)
```

## Tests

```bash
npm test -- --run
```

Los tests de integración usan SQLite en un directorio temporal y lo eliminan al finalizar.

```
tests/
├── permisos.test.ts                             # Permisos por rol
├── ventas-cuenta-corriente.test.ts              # Validaciones CC (unitario)
├── ventas-cuenta-corriente.integration.test.ts  # Venta CC con SQLite real
└── caja-stock-backup.test.ts                    # Caja, stock, backup y precios
```

## Auto-update

El updater apunta al repositorio `equazin/Sistema` en GitHub. Para publicar:

1. Actualizar `version` en `package.json`
2. `npm run package` — genera instalador NSIS y `latest.yml` en `dist/`
3. Subir `.exe` y `latest.yml` a GitHub Releases con tag `v<version>`

## Troubleshooting

**`NODE_MODULE_VERSION` mismatch al correr tests después de `npm run dev`:**
```bash
npm run sqlite:node
```

**`NODE_MODULE_VERSION` mismatch al arrancar la app después de `npm test`:**
```bash
npm run sqlite:electron
```

**Electron no arranca en dev — "cannot find module":**
Verificar que `node_modules/electron/dist/electron.exe` exista (ver sección Instalación).

## Roadmap

Ver [ROADMAP.md](./ROADMAP.md).
