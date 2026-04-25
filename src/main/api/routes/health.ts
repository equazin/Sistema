import type { IncomingMessage, ServerResponse } from 'http'
import { ok } from '../response'
import { getSqlite } from '../../db/database'

export function handleHealth(_req: IncomingMessage, res: ServerResponse): void {
  try {
    const db = getSqlite()
    const row = db.prepare('SELECT 1 as ok').get() as { ok: number }
    ok(res, { status: 'ok', db: row.ok === 1, version: '3.0.0', ts: new Date().toISOString() })
  } catch {
    ok(res, { status: 'ok', db: false, version: '3.0.0', ts: new Date().toISOString() })
  }
}
