import { handle } from './base'
import { getSqlite } from '../db/database'
import { shell, app } from 'electron'
import { google } from 'googleapis'
import { createReadStream, statSync } from 'fs'
import { ejecutarBackup } from './backup'

const SCOPES = ['https://www.googleapis.com/auth/drive.file']
const CONFIG_KEY = 'gdrive_config'

interface GDriveConfig {
  clientId: string
  clientSecret: string
  refreshToken: string
  folderId: string
}

function getConfig(): GDriveConfig | null {
  try {
    const db = getSqlite()
    const negocio = db.prepare('SELECT id FROM negocios LIMIT 1').get() as { id: number } | undefined
    if (!negocio) return null
    const row = db.prepare(
      `SELECT valor FROM configuracion WHERE negocio_id = ? AND clave = '${CONFIG_KEY}'`
    ).get(negocio.id) as { valor: string } | undefined
    if (!row) return null
    return JSON.parse(row.valor) as GDriveConfig
  } catch { return null }
}

function saveConfig(cfg: GDriveConfig): void {
  const db = getSqlite()
  const negocio = db.prepare('SELECT id FROM negocios LIMIT 1').get() as { id: number }
  db.prepare(`
    INSERT INTO configuracion (negocio_id, clave, valor) VALUES (?, '${CONFIG_KEY}', ?)
    ON CONFLICT(negocio_id, clave) DO UPDATE SET valor = excluded.valor
  `).run(negocio.id, JSON.stringify(cfg))
}

function makeOAuth2(cfg: Pick<GDriveConfig, 'clientId' | 'clientSecret'>) {
  return new google.auth.OAuth2(cfg.clientId, cfg.clientSecret, 'urn:ietf:wg:oauth:2.0:oob')
}

export function registerGDriveHandlers(): void {
  handle('gdrive:getConfig', () => {
    const cfg = getConfig()
    return cfg ? { configured: true, folderId: cfg.folderId } : { configured: false, folderId: '' }
  })

  handle('gdrive:setCredentials', ({ clientId, clientSecret, folderId }) => {
    const existing = getConfig()
    saveConfig({
      clientId,
      clientSecret,
      folderId,
      refreshToken: existing?.refreshToken ?? '',
    })
  })

  handle('gdrive:getAuthUrl', ({ clientId, clientSecret }) => {
    const auth = makeOAuth2({ clientId, clientSecret })
    const url = auth.generateAuthUrl({ access_type: 'offline', scope: SCOPES, prompt: 'consent' })
    shell.openExternal(url)
    return { url }
  })

  handle('gdrive:exchangeCode', async ({ code }) => {
    const cfg = getConfig()
    if (!cfg) throw new Error('Credenciales no configuradas')
    const auth = makeOAuth2(cfg)
    const { tokens } = await auth.getToken(code)
    if (!tokens.refresh_token) throw new Error('No se obtuvo refresh token — revoca el acceso en Google y vuelve a autorizar')
    saveConfig({ ...cfg, refreshToken: tokens.refresh_token })
  })

  handle('gdrive:upload', async ({ backupPath }) => {
    const cfg = getConfig()
    if (!cfg || !cfg.refreshToken) throw new Error('Google Drive no configurado o sin autorización')

    const auth = makeOAuth2(cfg)
    auth.setCredentials({ refresh_token: cfg.refreshToken })

    const drive = google.drive({ version: 'v3', auth })
    const fileName = backupPath.split(/[\\/]/).pop() ?? 'backup.db'
    const stat = statSync(backupPath)

    const res = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: cfg.folderId ? [cfg.folderId] : undefined,
      },
      media: {
        mimeType: 'application/octet-stream',
        body: createReadStream(backupPath),
      },
      fields: 'id,name,size',
    })

    return { fileId: res.data.id ?? '', name: res.data.name ?? fileName, size: stat.size }
  })

  handle('gdrive:backupAndUpload', async ({ destino }) => {
    const result = ejecutarBackup(destino)
    const cfg = getConfig()
    if (!cfg || !cfg.refreshToken) return { path: result.path, fecha: result.fecha, uploaded: false }

    const auth = makeOAuth2(cfg)
    auth.setCredentials({ refresh_token: cfg.refreshToken })
    const drive = google.drive({ version: 'v3', auth })
    const fileName = result.path.split(/[\\/]/).pop() ?? 'backup.db'

    await drive.files.create({
      requestBody: {
        name: fileName,
        parents: cfg.folderId ? [cfg.folderId] : undefined,
      },
      media: {
        mimeType: 'application/octet-stream',
        body: createReadStream(result.path),
      },
    })

    return { path: result.path, fecha: result.fecha, uploaded: true }
  })
}
