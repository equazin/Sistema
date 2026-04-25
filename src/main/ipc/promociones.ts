import { handle } from './base'
import { getSqlite } from '../db/database'
import type { Promocion, TipoPromocion } from '../../shared/types'

interface PromocionRow {
  id: number
  negocio_id: number
  nombre: string
  tipo: string
  valor: number
  producto_id: number | null
  categoria_id: number | null
  medio_pago: string | null
  vigencia_desde: string | null
  vigencia_hasta: string | null
  activa: number
  created_at: string
}

function mapPromocion(row: PromocionRow): Promocion {
  return {
    id: row.id,
    negocioId: row.negocio_id,
    nombre: row.nombre,
    tipo: row.tipo as TipoPromocion,
    valor: row.valor,
    productoId: row.producto_id,
    categoriaId: row.categoria_id,
    medioPago: row.medio_pago,
    vigenciaDesde: row.vigencia_desde,
    vigenciaHasta: row.vigencia_hasta,
    activa: Boolean(row.activa),
    createdAt: row.created_at,
  }
}

function isVigenteHoy(desde: string | null, hasta: string | null): boolean {
  const hoy = new Date().toISOString().slice(0, 10)
  if (desde && hoy < desde) return false
  if (hasta && hoy > hasta) return false
  return true
}

export function registerPromocionesHandlers(): void {
  handle('promociones:list', () => {
    const db = getSqlite()
    const rows = db.prepare('SELECT * FROM promociones ORDER BY nombre').all() as PromocionRow[]
    return rows.map(mapPromocion)
  })

  handle('promociones:create', (data) => {
    const db = getSqlite()
    const stmt = db.prepare(`
      INSERT INTO promociones (
        negocio_id, nombre, tipo, valor,
        producto_id, categoria_id, medio_pago,
        vigencia_desde, vigencia_hasta, activa
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(
      data.negocioId,
      data.nombre,
      data.tipo,
      data.valor,
      data.productoId ?? null,
      data.categoriaId ?? null,
      data.medioPago ?? null,
      data.vigenciaDesde ?? null,
      data.vigenciaHasta ?? null,
      data.activa ? 1 : 0
    )
    const row = db.prepare('SELECT * FROM promociones WHERE id = ?').get(result.lastInsertRowid) as PromocionRow
    return mapPromocion(row)
  })

  handle('promociones:update', ({ id, ...data }) => {
    const db = getSqlite()
    const fields: string[] = []
    const values: unknown[] = []

    const fieldMap: Record<string, string> = {
      nombre: 'nombre',
      tipo: 'tipo',
      valor: 'valor',
      productoId: 'producto_id',
      categoriaId: 'categoria_id',
      medioPago: 'medio_pago',
      vigenciaDesde: 'vigencia_desde',
      vigenciaHasta: 'vigencia_hasta',
      activa: 'activa',
    }

    for (const [key, col] of Object.entries(fieldMap)) {
      if (key in data) {
        fields.push(`${col} = ?`)
        const val = (data as Record<string, unknown>)[key]
        values.push(typeof val === 'boolean' ? (val ? 1 : 0) : val)
      }
    }

    if (fields.length === 0) throw new Error('No hay campos para actualizar')

    values.push(id)
    db.prepare(`UPDATE promociones SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    const row = db.prepare('SELECT * FROM promociones WHERE id = ?').get(id) as PromocionRow
    return mapPromocion(row)
  })

  handle('promociones:delete', ({ id }) => {
    const db = getSqlite()
    db.prepare('DELETE FROM promociones WHERE id = ?').run(id)
  })

  handle('promociones:calcular', ({ items, medioPago }) => {
    const db = getSqlite()

    // Fetch all active promotions
    const rows = db.prepare(
      "SELECT * FROM promociones WHERE activa = 1"
    ).all() as PromocionRow[]

    // Filter to only those vigent today
    const promociones = rows.map(mapPromocion).filter((p) =>
      isVigenteHoy(p.vigenciaDesde, p.vigenciaHasta)
    )

    // Per-product: track the best winner { promocionId, nombre, descuento }
    type ProductoWinner = { promocionId: number; nombre: string; descuento: number }
    const ganadorPorProducto = new Map<number, ProductoWinner>()

    // Single best medio-pago discount
    let ganadorMedioPago: { promocionId: number; nombre: string; descuento: number } | null = null

    // Single best monto-fijo discount
    let ganadorMontoFijo: { promocionId: number; nombre: string; descuento: number } | null = null

    const totalBruto = items.reduce(
      (sum, i) => sum + i.cantidad * i.precioUnitario,
      0
    )

    function calcularDescuentoProducto(
      promo: Promocion,
      item: { productoId: number; cantidad: number; precioUnitario: number }
    ): number {
      if (promo.tipo === 'porcentaje_producto' || promo.tipo === 'porcentaje_categoria') {
        return item.cantidad * item.precioUnitario * (promo.valor / 100)
      }
      if (promo.tipo === '2x1') {
        const gratis = Math.floor(item.cantidad / 2)
        return gratis * item.precioUnitario
      }
      if (promo.tipo === '3x2') {
        const gratis = Math.floor(item.cantidad / 3)
        return gratis * item.precioUnitario
      }
      return 0
    }

    for (const promo of promociones) {
      if (
        promo.tipo === 'porcentaje_producto' ||
        promo.tipo === '2x1' ||
        promo.tipo === '3x2'
      ) {
        if (promo.productoId === null) continue
        for (const item of items) {
          if (item.productoId !== promo.productoId) continue
          const descuento = calcularDescuentoProducto(promo, item)
          if (descuento <= 0) continue
          const prev = ganadorPorProducto.get(item.productoId)
          if (!prev || descuento > prev.descuento) {
            ganadorPorProducto.set(item.productoId, { promocionId: promo.id, nombre: promo.nombre, descuento })
          }
        }
      } else if (promo.tipo === 'porcentaje_categoria') {
        if (promo.categoriaId === null) continue
        for (const item of items) {
          if (item.categoriaId !== promo.categoriaId) continue
          const descuento = calcularDescuentoProducto(promo, item)
          if (descuento <= 0) continue
          const prev = ganadorPorProducto.get(item.productoId)
          if (!prev || descuento > prev.descuento) {
            ganadorPorProducto.set(item.productoId, { promocionId: promo.id, nombre: promo.nombre, descuento })
          }
        }
      } else if (promo.tipo === 'porcentaje_medio_pago') {
        if (promo.medioPago !== medioPago) continue
        const descuento = totalBruto * (promo.valor / 100)
        if (descuento > 0 && (!ganadorMedioPago || descuento > ganadorMedioPago.descuento)) {
          ganadorMedioPago = { promocionId: promo.id, nombre: promo.nombre, descuento }
        }
      } else if (promo.tipo === 'monto_fijo') {
        const descuento = promo.valor
        if (descuento > 0 && (!ganadorMontoFijo || descuento > ganadorMontoFijo.descuento)) {
          ganadorMontoFijo = { promocionId: promo.id, nombre: promo.nombre, descuento }
        }
      }
    }

    // Build final detalle from winners only
    const detalle: { promocionId: number; nombre: string; descuento: number }[] = [
      ...Array.from(ganadorPorProducto.values()),
      ...(ganadorMedioPago ? [ganadorMedioPago] : []),
      ...(ganadorMontoFijo ? [ganadorMontoFijo] : []),
    ]

    const descuentoTotal = detalle.reduce((s, d) => s + d.descuento, 0)

    return { descuentoTotal, detalle }
  })
}
