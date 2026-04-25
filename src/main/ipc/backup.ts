import { handle } from './base'
import { ipcMain, dialog, app } from 'electron'
import { getSqlite } from '../db/database'
import { join } from 'path'
import { copyFileSync, mkdirSync, existsSync, readdirSync, unlinkSync, statSync } from 'fs'

export function ejecutarBackup(destino?: string): { path: string; fecha: string } {
  const dbPath = join(app.getPath('userData'), 'sistema-pos.db')
  const dir = destino ?? join(app.getPath('userData'), 'backups')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const dest = join(dir, `backup-${ts}.db`)
  copyFileSync(dbPath, dest)

  const archivos = readdirSync(dir)
    .filter(f => f.startsWith('backup-') && f.endsWith('.db'))
    .map(f => ({ f, t: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t)
  archivos.slice(30).forEach(({ f }) => { try { unlinkSync(join(dir, f)) } catch { /* ignore */ } })

  return { path: dest, fecha: new Date().toISOString() }
}

export function registerBackupHandlers(): void {
  handle('backup:ejecutar', ({ destino }) => ejecutarBackup(destino))

  handle('backup:getConfig', () => {
    const db = getSqlite()
    const negocio = db.prepare('SELECT id FROM negocios LIMIT 1').get() as { id: number } | undefined
    if (!negocio) return null
    const row = db.prepare(
      "SELECT valor FROM configuracion WHERE negocio_id = ? AND clave = 'backup_config'"
    ).get(negocio.id) as { valor: string } | undefined
    if (!row) return null
    try { return JSON.parse(row.valor) as { carpeta: string; frecuencia: 'diario' | 'semanal' | 'manual' } }
    catch { return null }
  })

  handle('backup:setConfig', (config) => {
    const db = getSqlite()
    const negocio = db.prepare('SELECT id FROM negocios LIMIT 1').get() as { id: number }
    db.prepare(`
      INSERT INTO configuracion (negocio_id, clave, valor) VALUES (?, 'backup_config', ?)
      ON CONFLICT(negocio_id, clave) DO UPDATE SET valor = excluded.valor
    `).run(negocio.id, JSON.stringify(config))
  })

  handle('backup:listar', () => {
    const db = getSqlite()
    const negocio = db.prepare('SELECT id FROM negocios LIMIT 1').get() as { id: number } | undefined
    const carpetaDefault = join(app.getPath('userData'), 'backups')
    let carpeta = carpetaDefault
    if (negocio) {
      const row = db.prepare(
        "SELECT valor FROM configuracion WHERE negocio_id = ? AND clave = 'backup_config'"
      ).get(negocio.id) as { valor: string } | undefined
      if (row) {
        try { carpeta = (JSON.parse(row.valor) as { carpeta: string }).carpeta || carpetaDefault }
        catch { /* use default */ }
      }
    }
    if (!existsSync(carpeta)) return []
    return readdirSync(carpeta)
      .filter(f => f.startsWith('backup-') && f.endsWith('.db'))
      .map(f => {
        const stat = statSync(join(carpeta, f))
        return { nombre: f, path: join(carpeta, f), tamaño: stat.size, fecha: stat.mtime.toISOString() }
      })
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .slice(0, 30)
  })

  // Selector de carpeta nativo
  ipcMain.handle('backup:seleccionarCarpeta', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })
}

// Llamar desde app.whenReady para programar backup automático
export function iniciarBackupAutomatico(): void {
  // Ejecutar cada hora y verificar si corresponde hacer backup
  setInterval(() => { verificarBackupAutomatico() }, 60 * 60 * 1000)
  // También al arrancar
  setTimeout(() => verificarBackupAutomatico(), 30_000)
}

function verificarBackupAutomatico(): void {
  try {
    const db = getSqlite()
    const negocio = db.prepare('SELECT id FROM negocios LIMIT 1').get() as { id: number } | undefined
    if (!negocio) return
    const row = db.prepare(
      "SELECT valor FROM configuracion WHERE negocio_id = ? AND clave = 'backup_config'"
    ).get(negocio.id) as { valor: string } | undefined
    if (!row) return

    const config = JSON.parse(row.valor) as { carpeta: string; frecuencia: 'diario' | 'semanal' | 'manual'; ultimoBackup?: string }
    if (config.frecuencia === 'manual') return

    const ahora = new Date()
    const ultimo = config.ultimoBackup ? new Date(config.ultimoBackup) : new Date(0)
    const horasDiff = (ahora.getTime() - ultimo.getTime()) / (1000 * 60 * 60)

    const debeBackup = config.frecuencia === 'diario' ? horasDiff >= 23 : horasDiff >= 167

    if (debeBackup) {
      const dbPath = join(app.getPath('userData'), 'sistema-pos.db')
      const dir = config.carpeta || join(app.getPath('userData'), 'backups')
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      const ts = ahora.toISOString().replace(/[:.]/g, '-').slice(0, 19)
      copyFileSync(dbPath, join(dir, `backup-${ts}.db`))

      // Actualizar ultimoBackup
      const nuevoConfig = { ...config, ultimoBackup: ahora.toISOString() }
      db.prepare(
        "UPDATE configuracion SET valor = ? WHERE negocio_id = ? AND clave = 'backup_config'"
      ).run(JSON.stringify(nuevoConfig), negocio.id)
    }
  } catch { /* no interrumpir la app por un error de backup */ }
}
