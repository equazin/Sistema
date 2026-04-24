import { handle } from './base'
import { getSqlite } from '../db/database'
import type { TurnoCaja } from '../../shared/types'

export function registerCajaHandlers(): void {
  handle('turno:actual', ({ cajaId }) => {
    const db = getSqlite()
    const row = db.prepare(
      "SELECT * FROM turnos_caja WHERE caja_id = ? AND estado = 'abierto' LIMIT 1"
    ).get(cajaId)
    return row ? mapTurno(row as Record<string, unknown>) : null
  })

  handle('turno:abrir', ({ cajaId, usuarioId, montoApertura }) => {
    const db = getSqlite()
    const turnoAbierto = db.prepare(
      "SELECT id FROM turnos_caja WHERE caja_id = ? AND estado = 'abierto'"
    ).get(cajaId)
    if (turnoAbierto) throw new Error('Ya hay un turno abierto en esta caja')

    const result = db.prepare(`
      INSERT INTO turnos_caja (caja_id, usuario_id, monto_apertura)
      VALUES (?, ?, ?)
    `).run(cajaId, usuarioId, montoApertura)
    const row = db.prepare('SELECT * FROM turnos_caja WHERE id = ?').get(result.lastInsertRowid)
    return mapTurno(row as Record<string, unknown>)
  })

  handle('turno:cerrar', ({ turnoId, montoCierreDeclado }) => {
    const db = getSqlite()
    const turno = db.prepare('SELECT * FROM turnos_caja WHERE id = ?').get(turnoId) as Record<string, unknown> | undefined
    if (!turno) throw new Error('Turno no encontrado')
    if (turno.estado === 'cerrado') throw new Error('El turno ya está cerrado')

    // Calculate system total from payments in this turno
    const totalSistema = (db.prepare(`
      SELECT COALESCE(SUM(pv.monto), 0) as total
      FROM pagos_venta pv
      JOIN ventas v ON v.id = pv.venta_id
      WHERE v.turno_id = ? AND v.estado = 'completada' AND pv.medio_pago = 'efectivo'
    `).get(turnoId) as { total: number }).total

    const diferencia = montoCierreDeclado - totalSistema

    db.prepare(`
      UPDATE turnos_caja
      SET estado = 'cerrado',
          cierre_at = datetime('now','localtime'),
          monto_cierre_declado = ?,
          monto_cierre_sistema = ?,
          diferencia = ?
      WHERE id = ?
    `).run(montoCierreDeclado, totalSistema, diferencia, turnoId)

    const row = db.prepare('SELECT * FROM turnos_caja WHERE id = ?').get(turnoId)
    return mapTurno(row as Record<string, unknown>)
  })
}

function mapTurno(row: Record<string, unknown>): TurnoCaja {
  return {
    id: row.id as number,
    cajaId: row.caja_id as number,
    usuarioId: row.usuario_id as number,
    aperturaAt: row.apertura_at as string,
    cierreAt: row.cierre_at as string | null,
    montoApertura: row.monto_apertura as number,
    montoCierreDeclado: row.monto_cierre_declado as number | null,
    montoCierre_sistema: row.monto_cierre_sistema as number | null,
    diferencia: row.diferencia as number | null,
    estado: row.estado as TurnoCaja['estado'],
  }
}
