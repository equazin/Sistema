import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'http'
import { getSqlite } from '../db/database'
import { validateApiKey } from './auth'
import { checkRateLimit } from './rate-limit'
import { error, preflight } from './response'
import { getPathParts } from './router'
import { handleHealth } from './routes/health'
import { handleProductos } from './routes/productos'
import { handleVentas } from './routes/ventas'
import { handleStock } from './routes/stock'
import { handleCaja } from './routes/caja'
import { handleClientes } from './routes/clientes'

let _server: Server | null = null
let _port = 3001
let _apiKeyHash = ''

export interface ApiServerConfig {
  enabled: boolean
  port: number
  apiKeyHash: string
  apiKeyPreview: string
  bindLocalhostOnly: boolean
}

function getStoredConfig(): ApiServerConfig | null {
  try {
    const db = getSqlite()
    const negocio = db.prepare('SELECT id FROM negocios LIMIT 1').get() as { id: number } | undefined
    if (!negocio) return null
    const row = db.prepare(
      "SELECT valor FROM configuracion WHERE negocio_id = ? AND clave = 'api_config'"
    ).get(negocio.id) as { valor: string } | undefined
    if (!row) return null
    return JSON.parse(row.valor) as ApiServerConfig
  } catch {
    return null
  }
}

export function saveApiConfig(config: ApiServerConfig): void {
  const db = getSqlite()
  const negocio = db.prepare('SELECT id FROM negocios LIMIT 1').get() as { id: number }
  db.prepare(`
    INSERT INTO configuracion (negocio_id, clave, valor) VALUES (?, 'api_config', ?)
    ON CONFLICT(negocio_id, clave) DO UPDATE SET valor = excluded.valor
  `).run(negocio.id, JSON.stringify(config))
}

function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  const ip = req.socket.remoteAddress ?? 'unknown'

  if (req.method === 'OPTIONS') return preflight(res)

  const parts = getPathParts(req.url ?? '/')
  // parts[0] = 'api', parts[1] = 'v1', parts[2] = resource

  // Health check — no auth required
  if (parts[0] === 'api' && parts[1] === 'v1' && parts[2] === 'health') {
    return handleHealth(req, res)
  }

  // Rate limit
  if (!checkRateLimit(ip)) return error(res, 429, 'Demasiadas peticiones')

  // Auth
  const apiKey = req.headers['x-api-key'] as string | undefined
    ?? (req.headers['authorization'] as string | undefined)?.replace(/^Bearer\s+/i, '')
  if (!apiKey || !_apiKeyHash || !validateApiKey(apiKey, _apiKeyHash)) {
    return error(res, 401, 'API key inválida o faltante')
  }

  if (parts[0] !== 'api' || parts[1] !== 'v1') return error(res, 404, 'Ruta no encontrada')

  const resource = parts[2]
  try {
    if (resource === 'productos') return handleProductos(req, res, parts)
    if (resource === 'ventas') { handleVentas(req, res).catch(() => error(res, 500, 'Error interno')); return }
    if (resource === 'stock') return handleStock(req, res, parts)
    if (resource === 'caja') return handleCaja(req, res, parts)
    if (resource === 'clientes') return handleClientes(req, res, parts)
    return error(res, 404, 'Recurso no encontrado')
  } catch (e) {
    error(res, 500, e instanceof Error ? e.message : 'Error interno del servidor')
  }
}

export async function startApiServer(config: ApiServerConfig): Promise<{ port: number }> {
  if (_server) await stopApiServer()
  _port = config.port
  _apiKeyHash = config.apiKeyHash

  return new Promise((resolve, reject) => {
    const host = config.bindLocalhostOnly ? '127.0.0.1' : '0.0.0.0'
    _server = createServer(handleRequest)
    _server.on('error', (err: NodeJS.ErrnoException) => {
      _server = null
      reject(err)
    })
    _server.listen(_port, host, () => resolve({ port: _port }))
  })
}

export async function stopApiServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!_server) return resolve()
    _server.close(() => { _server = null; resolve() })
  })
}

export function isApiServerRunning(): boolean {
  return _server !== null && _server.listening
}

export async function startApiServerIfEnabled(): Promise<void> {
  const config = getStoredConfig()
  if (!config?.enabled || !config.apiKeyHash) return
  try {
    await startApiServer(config)
  } catch {
    // Non-fatal — port may be in use, will show error in ConfigPage
  }
}
