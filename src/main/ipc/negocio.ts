import { handle } from './base'
import { getSqlite } from '../db/database'
import type { Negocio } from '../../shared/types'

export function registerNegocioHandlers(): void {
  handle('negocio:get', () => {
    const db = getSqlite()
    const row = db.prepare('SELECT * FROM negocios LIMIT 1').get()
    return row ? mapNegocio(row as Record<string, unknown>) : null
  })

  handle('negocio:save', (data) => {
    const db = getSqlite()
    const existing = db.prepare('SELECT id FROM negocios LIMIT 1').get() as { id: number } | undefined

    if (existing) {
      const fields: string[] = []
      const values: unknown[] = []
      const fieldMap: Record<string, string> = {
        nombre: 'nombre',
        razonSocial: 'razon_social',
        cuit: 'cuit',
        condicionAfip: 'condicion_afip',
        domicilio: 'domicilio',
        telefono: 'telefono',
        logoPath: 'logo_path',
      }
      for (const [key, col] of Object.entries(fieldMap)) {
        if (key in data) {
          fields.push(`${col} = ?`)
          values.push((data as Record<string, unknown>)[key])
        }
      }
      values.push(existing.id)
      db.prepare(`UPDATE negocios SET ${fields.join(', ')} WHERE id = ?`).run(...values)
      const row = db.prepare('SELECT * FROM negocios WHERE id = ?').get(existing.id)
      return mapNegocio(row as Record<string, unknown>)
    }

    const result = db.prepare(`
      INSERT INTO negocios (nombre, razon_social, cuit, condicion_afip, domicilio, telefono)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      data.nombre ?? 'Mi Comercio',
      data.razonSocial ?? 'Mi Comercio',
      data.cuit ?? '00-00000000-0',
      data.condicionAfip ?? 'monotributo',
      data.domicilio ?? '',
      data.telefono ?? ''
    )
    const row = db.prepare('SELECT * FROM negocios WHERE id = ?').get(result.lastInsertRowid)
    return mapNegocio(row as Record<string, unknown>)
  })
}

function mapNegocio(row: Record<string, unknown>): Negocio {
  return {
    id: row.id as number,
    nombre: row.nombre as string,
    razonSocial: row.razon_social as string,
    cuit: row.cuit as string,
    condicionAfip: row.condicion_afip as Negocio['condicionAfip'],
    domicilio: row.domicilio as string,
    telefono: row.telefono as string,
    logoPath: row.logo_path as string | null,
    createdAt: row.created_at as string,
  }
}
