import { handle } from './base'
import { getSqlite } from '../db/database'
import type { PreviewPrecio, ActualizacionMasiva } from '../../shared/types'
import { assertPermisoUsuario } from './permisos'

// ─── helpers ────────────────────────────────────────────────────────────────

function aplicarRedondeo(precio: number, redondear: ActualizacionMasiva['redondear']): number {
  switch (redondear) {
    case 'entero':
      return Math.round(precio)
    case 'decena':
      return Math.round(precio / 10) * 10
    case 'centena':
      return Math.round(precio / 100) * 100
    default:
      return Math.round(precio * 100) / 100
  }
}

interface ProductoRow {
  id: number
  codigo_barras: string | null
  nombre: string
  precio_venta: number
}

function buildPreview(row: ProductoRow, precioNuevo: number): PreviewPrecio {
  const diferencia = precioNuevo - row.precio_venta
  const diferenciaPct =
    row.precio_venta !== 0
      ? (diferencia / row.precio_venta) * 100
      : 0

  return {
    productoId: row.id,
    codigoBarras: row.codigo_barras,
    nombre: row.nombre,
    precioActual: row.precio_venta,
    precioNuevo,
    diferencia: Math.round(diferencia * 100) / 100,
    diferenciaPct: Math.round(diferenciaPct * 100) / 100,
  }
}

// ─── handlers ───────────────────────────────────────────────────────────────

export function registerPreciosHandlers(): void {

  // ── parsearCSV ─────────────────────────────────────────────────────────────
  handle('precios:parsearCSV', ({ contenido }) => {
    const lines = contenido.split(/\r?\n/)
    const items: { codigoBarras: string; precioVenta: number }[] = []
    const errores: string[] = []

    for (let i = 0; i < lines.length; i++) {
      const linea = lines[i].trim()
      if (!linea) continue

      const partes = linea.split(',')
      if (partes.length < 2) {
        errores.push(`Línea ${i + 1}: formato incorrecto (se esperaba codigoBarras,precioVenta)`)
        continue
      }

      const codigoRaw = partes[0].trim()
      const precioRaw = partes[1].trim()

      // Si la primera fila contiene un encabezado no numérico, ignorarla
      if (i === 0 && isNaN(Number(precioRaw))) {
        continue
      }

      if (!codigoRaw) {
        errores.push(`Línea ${i + 1}: código de barras vacío`)
        continue
      }

      const precio = Number(precioRaw)
      if (isNaN(precio) || precio < 0) {
        errores.push(`Línea ${i + 1}: precio inválido "${precioRaw}"`)
        continue
      }

      items.push({ codigoBarras: codigoRaw, precioVenta: precio })
    }

    return { items, errores }
  })

  // ── preview ────────────────────────────────────────────────────────────────
  handle('precios:preview', (req) => {
    const db = getSqlite()

    if (req.tipo === 'porcentaje') {
      const porcentaje = req.porcentaje ?? 0
      const conditions: string[] = []
      const params: (string | number)[] = []

      if (req.soloActivos !== false) {
        conditions.push('activo = 1')
      }
      if (req.soloCategoria != null) {
        conditions.push('categoria_id = ?')
        params.push(req.soloCategoria)
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
      const rows = db
        .prepare(`SELECT id, codigo_barras, nombre, precio_venta FROM productos ${where} ORDER BY nombre`)
        .all(...params) as ProductoRow[]

      return rows.map((row) => {
        const precioNuevo = aplicarRedondeo(
          row.precio_venta * (1 + porcentaje / 100),
          req.redondear
        )
        return buildPreview(row, precioNuevo)
      })
    }

    // tipo === 'csv'
    const items = req.items ?? []
    const previews: PreviewPrecio[] = []

    for (const item of items) {
      const row = db
        .prepare('SELECT id, codigo_barras, nombre, precio_venta FROM productos WHERE codigo_barras = ? LIMIT 1')
        .get(item.codigoBarras) as ProductoRow | undefined

      if (!row) continue

      previews.push(buildPreview(row, item.precioVenta))
    }

    return previews.sort((a, b) => a.nombre.localeCompare(b.nombre))
  })

  // ── aplicar ────────────────────────────────────────────────────────────────
  handle('precios:aplicar', (req) => {
    const db = getSqlite()
    const { usuarioId, ...actualizacion } = req
    assertPermisoUsuario(db, usuarioId, 'precios:actualizar')

    // Reuse preview logic to get the list of changes
    let previews: PreviewPrecio[]

    if (actualizacion.tipo === 'porcentaje') {
      const porcentaje = actualizacion.porcentaje ?? 0
      const conditions: string[] = []
      const params: (string | number)[] = []

      if (actualizacion.soloActivos !== false) {
        conditions.push('activo = 1')
      }
      if (actualizacion.soloCategoria != null) {
        conditions.push('categoria_id = ?')
        params.push(actualizacion.soloCategoria)
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
      const rows = db
        .prepare(`SELECT id, codigo_barras, nombre, precio_venta FROM productos ${where}`)
        .all(...params) as ProductoRow[]

      previews = rows.map((row) => {
        const precioNuevo = aplicarRedondeo(
          row.precio_venta * (1 + porcentaje / 100),
          actualizacion.redondear
        )
        return buildPreview(row, precioNuevo)
      })
    } else {
      const items = actualizacion.items ?? []
      previews = []

      for (const item of items) {
        const row = db
          .prepare('SELECT id, codigo_barras, nombre, precio_venta FROM productos WHERE codigo_barras = ? LIMIT 1')
          .get(item.codigoBarras) as ProductoRow | undefined

        if (!row) continue
        previews.push(buildPreview(row, item.precioVenta))
      }
    }

    // Execute all updates inside a single transaction
    const updateStmt = db.prepare(
      "UPDATE productos SET precio_venta = ?, updated_at = datetime('now','localtime') WHERE id = ?"
    )

    const runTransaction = db.transaction((items: PreviewPrecio[]) => {
      for (const p of items) {
        updateStmt.run(p.precioNuevo, p.productoId)
      }
    })

    runTransaction(previews)

    // Audit log
    const detalle = JSON.stringify({
      tipo: actualizacion.tipo,
      porcentaje: actualizacion.porcentaje ?? null,
      soloCategoria: actualizacion.soloCategoria ?? null,
      soloActivos: actualizacion.soloActivos ?? true,
      actualizados: previews.length,
    })

    db.prepare(
      `INSERT INTO audit_log (usuario_id, accion, tabla, detalle)
       VALUES (?, 'actualizacion_precios', 'productos', ?)`
    ).run(usuarioId, detalle)

    return { actualizados: previews.length }
  })
}
