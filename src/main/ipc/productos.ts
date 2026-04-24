import { handle } from './base'
import { getSqlite } from '../db/database'
import type { Producto } from '../../shared/types'

export function registerProductosHandlers(): void {
  handle('productos:list', ({ page = 1, limit = 50, search, categoriaId }) => {
    const db = getSqlite()
    const offset = (page - 1) * limit
    const conditions: string[] = ['p.activo = 1']
    const params: (string | number)[] = []

    if (search) {
      conditions.push('(p.nombre LIKE ? OR p.codigo_barras LIKE ? OR p.codigo_interno LIKE ?)')
      const s = `%${search}%`
      params.push(s, s, s)
    }
    if (categoriaId) {
      conditions.push('p.categoria_id = ?')
      params.push(categoriaId)
    }

    const where = conditions.join(' AND ')
    const countRow = db.prepare(`SELECT COUNT(*) as c FROM productos p WHERE ${where}`).get(...params) as { c: number }
    const items = db.prepare(`SELECT * FROM productos p WHERE ${where} ORDER BY p.nombre LIMIT ? OFFSET ?`).all(...params, limit, offset) as Record<string, unknown>[]

    return { items: items.map(mapProducto), total: countRow.c }
  })

  handle('productos:get', ({ id }) => {
    const db = getSqlite()
    const row = db.prepare('SELECT * FROM productos WHERE id = ?').get(id)
    if (!row) throw new Error(`Producto ${id} no encontrado`)
    return mapProducto(row as Record<string, unknown>)
  })

  handle('productos:findByBarcode', ({ barcode }) => {
    const db = getSqlite()
    const row = db.prepare('SELECT * FROM productos WHERE codigo_barras = ? AND activo = 1 LIMIT 1').get(barcode)
    return row ? mapProducto(row as Record<string, unknown>) : null
  })

  handle('productos:create', (data) => {
    const db = getSqlite()
    const stmt = db.prepare(`
      INSERT INTO productos (
        negocio_id, codigo_barras, codigo_interno, nombre, descripcion,
        categoria_id, unidad_medida, precio_costo, precio_venta, precio_mayorista,
        stock_actual, stock_minimo, stock_maximo, pesable
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(
      data.negocioId,
      data.codigoBarras ?? null,
      data.codigoInterno ?? null,
      data.nombre,
      data.descripcion ?? null,
      data.categoriaId ?? null,
      data.unidadMedida,
      data.precioCosto,
      data.precioVenta,
      data.precioMayorista ?? null,
      data.stockActual,
      data.stockMinimo,
      data.stockMaximo ?? null,
      data.pesable ? 1 : 0
    )
    const row = db.prepare('SELECT * FROM productos WHERE id = ?').get(result.lastInsertRowid)
    return mapProducto(row as Record<string, unknown>)
  })

  handle('productos:update', ({ id, ...data }) => {
    const db = getSqlite()
    const fields: string[] = []
    const values: unknown[] = []

    const fieldMap: Record<string, string> = {
      nombre: 'nombre',
      descripcion: 'descripcion',
      codigoBarras: 'codigo_barras',
      codigoInterno: 'codigo_interno',
      categoriaId: 'categoria_id',
      unidadMedida: 'unidad_medida',
      precioCosto: 'precio_costo',
      precioVenta: 'precio_venta',
      precioMayorista: 'precio_mayorista',
      stockActual: 'stock_actual',
      stockMinimo: 'stock_minimo',
      stockMaximo: 'stock_maximo',
      pesable: 'pesable',
      activo: 'activo',
    }

    for (const [key, col] of Object.entries(fieldMap)) {
      if (key in data) {
        fields.push(`${col} = ?`)
        const val = (data as Record<string, unknown>)[key]
        values.push(typeof val === 'boolean' ? (val ? 1 : 0) : val)
      }
    }

    if (fields.length === 0) throw new Error('No hay campos para actualizar')

    fields.push("updated_at = datetime('now','localtime')")
    values.push(id)

    db.prepare(`UPDATE productos SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    const row = db.prepare('SELECT * FROM productos WHERE id = ?').get(id)
    return mapProducto(row as Record<string, unknown>)
  })

  handle('productos:delete', ({ id }) => {
    const db = getSqlite()
    db.prepare("UPDATE productos SET activo = 0 WHERE id = ?").run(id)
  })
}

function mapProducto(row: Record<string, unknown>): Producto {
  return {
    id: row.id as number,
    negocioId: row.negocio_id as number,
    codigoBarras: row.codigo_barras as string | null,
    codigoInterno: row.codigo_interno as string | null,
    nombre: row.nombre as string,
    descripcion: row.descripcion as string | null,
    categoriaId: row.categoria_id as number | null,
    unidadMedida: row.unidad_medida as Producto['unidadMedida'],
    precioCosto: row.precio_costo as number,
    precioVenta: row.precio_venta as number,
    precioMayorista: row.precio_mayorista as number | null,
    stockActual: row.stock_actual as number,
    stockMinimo: row.stock_minimo as number,
    stockMaximo: row.stock_maximo as number | null,
    pesable: Boolean(row.pesable),
    activo: Boolean(row.activo),
    updatedAt: row.updated_at as string,
  }
}
