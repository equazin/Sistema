import { handle } from './base'
import { generateApiKey } from '../api/auth'
import { startApiServer, stopApiServer, isApiServerRunning, saveApiConfig, type ApiServerConfig } from '../api/server'
import { getSqlite } from '../db/database'

function getConfig(): ApiServerConfig | null {
  try {
    const db = getSqlite()
    const negocio = db.prepare('SELECT id FROM negocios LIMIT 1').get() as { id: number } | undefined
    if (!negocio) return null
    const row = db.prepare(
      "SELECT valor FROM configuracion WHERE negocio_id = ? AND clave = 'api_config'"
    ).get(negocio.id) as { valor: string } | undefined
    if (!row) return null
    return JSON.parse(row.valor) as ApiServerConfig
  } catch { return null }
}

export function registerApiConfigHandlers(): void {
  handle('api:getConfig', () => {
    const config = getConfig()
    return {
      enabled: config?.enabled ?? false,
      port: config?.port ?? 3001,
      apiKeyPreview: config?.apiKeyPreview ?? '',
      bindLocalhostOnly: config?.bindLocalhostOnly ?? false,
      running: isApiServerRunning(),
    }
  })

  handle('api:setConfig', async ({ enabled, port, bindLocalhostOnly }) => {
    const existing = getConfig()
    const updated: ApiServerConfig = {
      enabled,
      port: port ?? 3001,
      apiKeyHash: existing?.apiKeyHash ?? '',
      apiKeyPreview: existing?.apiKeyPreview ?? '',
      bindLocalhostOnly: bindLocalhostOnly ?? false,
    }
    saveApiConfig(updated)

    if (enabled && updated.apiKeyHash) {
      await startApiServer(updated)
    } else {
      await stopApiServer()
    }
  })

  handle('api:rotateKey', async () => {
    const existing = getConfig()
    const { raw, hash, preview } = generateApiKey()
    const updated: ApiServerConfig = {
      enabled: existing?.enabled ?? false,
      port: existing?.port ?? 3001,
      apiKeyHash: hash,
      apiKeyPreview: preview,
      bindLocalhostOnly: existing?.bindLocalhostOnly ?? false,
    }
    saveApiConfig(updated)
    if (updated.enabled) {
      await startApiServer(updated)
    }
    return { rawKey: raw, preview }
  })

  handle('api:status', () => ({
    running: isApiServerRunning(),
  }))
}
