import { handle } from './base'
import { getSqlite } from '../db/database'
import type { SyncOutboxEntry } from '../../shared/types'

function mapEntry(r: Record<string, unknown>): SyncOutboxEntry {
  return {
    id: r.id as number,
    sucursalId: r.sucursal_id as number,
    tabla: r.tabla as string,
    operacion: r.operacion as SyncOutboxEntry['operacion'],
    payload: r.payload as string,
    createdAt: r.created_at as string,
    syncedAt: r.synced_at as string | null,
  }
}

export function registerSyncHandlers(): void {
  handle('sync:pendientes', ({ sucursalId }) => {
    const db = getSqlite()
    const rows = db.prepare(
      'SELECT * FROM sync_outbox WHERE sucursal_id = ? AND synced_at IS NULL ORDER BY id ASC LIMIT 500'
    ).all(sucursalId) as Record<string, unknown>[]
    return rows.map(mapEntry)
  })

  handle('sync:confirmar', ({ ids }) => {
    if (!ids || ids.length === 0) return
    const db = getSqlite()
    const update = db.prepare("UPDATE sync_outbox SET synced_at = datetime('now','localtime') WHERE id = ?")
    db.transaction(() => {
      for (const id of ids) update.run(id)
    })()
  })
}
