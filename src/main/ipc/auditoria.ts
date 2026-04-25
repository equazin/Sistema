import type Database from 'better-sqlite3'
import { handle } from './base'
import { getSqlite } from '../db/database'
import type { AuditoriaEntry } from '../../shared/types'

interface AuditInput {
  usuarioId?: number | null
  accion: string
  tabla?: string | null
  referenciaId?: number | null
  detalle?: unknown
}

export function registrarAuditoria(db: Database.Database, input: AuditInput): void {
  db.prepare(`
    INSERT INTO audit_log (usuario_id, accion, tabla, referencia_id, detalle)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    input.usuarioId ?? null,
    input.accion,
    input.tabla ?? null,
    input.referenciaId ?? null,
    input.detalle === undefined || input.detalle === null
      ? null
      : typeof input.detalle === 'string'
        ? input.detalle
        : JSON.stringify(input.detalle)
  )
}

export function registerAuditoriaHandlers(): void {
  handle('auditoria:list', ({ limit }) => {
    const db = getSqlite()
    const rows = db.prepare(`
      SELECT a.*, u.nombre AS nombre_usuario
      FROM audit_log a
      LEFT JOIN usuarios u ON u.id = a.usuario_id
      ORDER BY a.fecha DESC, a.id DESC
      LIMIT ?
    `).all(Math.min(Math.max(limit ?? 50, 1), 200)) as Record<string, unknown>[]

    return rows.map(mapAuditoriaEntry)
  })
}

function mapAuditoriaEntry(row: Record<string, unknown>): AuditoriaEntry {
  return {
    id: row.id as number,
    usuarioId: row.usuario_id as number | null,
    nombreUsuario: row.nombre_usuario as string | null,
    accion: row.accion as string,
    tabla: row.tabla as string | null,
    referenciaId: row.referencia_id as number | null,
    detalle: row.detalle as string | null,
    fecha: row.fecha as string,
  }
}
