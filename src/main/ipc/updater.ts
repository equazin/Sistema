import { ipcMain, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'

export function setupAutoUpdater(): void {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    broadcast('updater:status', { estado: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    broadcast('updater:status', { estado: 'available', version: info.version, fecha: info.releaseDate })
  })

  autoUpdater.on('update-not-available', () => {
    broadcast('updater:status', { estado: 'up_to_date' })
  })

  autoUpdater.on('download-progress', (progress) => {
    broadcast('updater:status', {
      estado: 'downloading',
      progreso: Math.round(progress.percent),
      velocidad: Math.round(progress.bytesPerSecond / 1024),
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    broadcast('updater:status', { estado: 'ready', version: info.version })
  })

  autoUpdater.on('error', (err) => {
    broadcast('updater:status', { estado: 'error', mensaje: err.message })
  })

  ipcMain.handle('updater:checkForUpdates', async () => {
    try {
      await autoUpdater.checkForUpdates()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido' }
    }
  })

  ipcMain.handle('updater:descargar', async () => {
    try {
      await autoUpdater.downloadUpdate()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Error al descargar' }
    }
  })

  ipcMain.handle('updater:instalar', () => {
    autoUpdater.quitAndInstall(false, true)
  })
}

function broadcast(channel: string, data: unknown): void {
  BrowserWindow.getAllWindows().forEach((w) => {
    if (!w.isDestroyed()) w.webContents.send(channel, data)
  })
}
