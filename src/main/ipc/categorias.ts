import { handle } from './base'
import { getSqlite } from '../db/database'
import type { Categoria } from '../../shared/types'

export function registerCategoriasHandlers(): void {
  handle('categorias:list', () => {
    const db = getSqlite()
    const rows = db.prepare('SELECT * FROM categorias ORDER BY nombre').all() as Record<string, unknown>[]
    return rows.map(mapCategoria)
  })

  handle('categorias:create', ({ nombre, categoriaPadreId }) => {
    const db = getSqlite()
    // negocio_id 1 for MVP (single-negocio)
    const result = db.prepare(
      'INSERT INTO categorias (negocio_id, nombre, categoria_padre_id) VALUES (1, ?, ?)'
    ).run(nombre, categoriaPadreId ?? null)
    const row = db.prepare('SELECT * FROM categorias WHERE id = ?').get(result.lastInsertRowid)
    return mapCategoria(row as Record<string, unknown>)
  })
}

function mapCategoria(row: Record<string, unknown>): Categoria {
  return {
    id: row.id as number,
    negocioId: row.negocio_id as number,
    nombre: row.nombre as string,
    categoriaPadreId: row.categoria_padre_id as number | null,
  }
}
