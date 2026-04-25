import { handle } from './base'
import { getSqlite } from '../db/database'
import type { PagoVenta, Venta, VentaDetalle } from '../../shared/types'
import { registrarAuditoria } from './auditoria'

interface ClienteCuentaCorriente {
  id: number
  nombre: string
  saldo_cuenta_corriente: number
  limite_credito: number
  activo: number
}

export function calcularMontoCuentaCorriente(pagos: PagoVenta[]): number {
  return pagos
    .filter((p) => p.medioPago === 'cuenta_corriente')
    .reduce((sum, p) => sum + p.monto, 0)
}

export function validarCuentaCorrienteVenta(params: {
  clienteId: number | null
  cliente: ClienteCuentaCorriente | undefined
  montoCuentaCorriente: number
}): void {
  const { clienteId, cliente, montoCuentaCorriente } = params
  if (montoCuentaCorriente <= 0) return

  if (!clienteId) {
    throw new Error('Seleccioná un cliente para cobrar por cuenta corriente')
  }

  if (!cliente || !cliente.activo) {
    throw new Error('Cliente no válido para cuenta corriente')
  }

  const saldoNuevo = cliente.saldo_cuenta_corriente + montoCuentaCorriente
  if (saldoNuevo > cliente.limite_credito) {
    throw new Error(`La cuenta corriente supera el límite de crédito de ${cliente.nombre}`)
  }
}

export function registerVentasHandlers(): void {
  handle('ventas:crear', (data) => {
    const db = getSqlite()

    const createVenta = db.transaction(() => {
      const subtotal = data.items.reduce((sum, i) => sum + i.subtotal, 0)
      const total = subtotal - data.descuentoTotal
      const montoCuentaCorriente = calcularMontoCuentaCorriente(data.pagos)

      if (montoCuentaCorriente > 0) {
        const cliente = db.prepare(`
          SELECT id, nombre, saldo_cuenta_corriente, limite_credito, activo
          FROM clientes
          WHERE id = ?
        `).get(data.clienteId) as ClienteCuentaCorriente | undefined

        validarCuentaCorrienteVenta({
          clienteId: data.clienteId,
          cliente,
          montoCuentaCorriente,
        })
      }

      const ventaResult = db.prepare(`
        INSERT INTO ventas (turno_id, sucursal_id, usuario_id, cliente_id, subtotal, descuento_total, total, tipo_comprobante)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        data.turnoId,
        data.sucursalId,
        data.usuarioId,
        data.clienteId ?? null,
        subtotal,
        data.descuentoTotal,
        total,
        data.tipoComprobante
      )
      const ventaId = ventaResult.lastInsertRowid as number

      const itemStmt = db.prepare(`
        INSERT INTO items_venta (venta_id, producto_id, cantidad, precio_unitario, descuento, subtotal, pesable)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      const stockStmt = db.prepare(`
        UPDATE productos SET stock_actual = stock_actual - ?, updated_at = datetime('now','localtime')
        WHERE id = ?
      `)
      const movStmt = db.prepare(`
        INSERT INTO movimientos_stock (producto_id, tipo, cantidad, cantidad_anterior, motivo, referencia_id, referencia_tipo, usuario_id)
        SELECT ?, 'salida', ?, stock_actual + ?, 'venta', ?, 'venta', ?
        FROM productos WHERE id = ?
      `)

      for (const item of data.items) {
        itemStmt.run(ventaId, item.productoId, item.cantidad, item.precioUnitario, item.descuento, item.subtotal, item.pesable ? 1 : 0)
        movStmt.run(item.productoId, item.cantidad, item.cantidad, ventaId, data.usuarioId, item.productoId)
        stockStmt.run(item.cantidad, item.productoId)
      }

      const pagoStmt = db.prepare(`
        INSERT INTO pagos_venta (venta_id, medio_pago, monto, referencia)
        VALUES (?, ?, ?, ?)
      `)
      for (const pago of data.pagos) {
        pagoStmt.run(ventaId, pago.medioPago, pago.monto, pago.referencia ?? null)
      }

      if (montoCuentaCorriente > 0 && data.clienteId) {
        db.prepare(`
          UPDATE clientes
          SET saldo_cuenta_corriente = saldo_cuenta_corriente + ?
          WHERE id = ?
        `).run(montoCuentaCorriente, data.clienteId)
      }

      registrarAuditoria(db, {
        usuarioId: data.usuarioId,
        accion: 'venta_creada',
        tabla: 'ventas',
        referenciaId: ventaId,
        detalle: {
          total,
          clienteId: data.clienteId,
          mediosPago: data.pagos.map((p) => p.medioPago),
        },
      })

      return ventaId
    })

    const ventaId = createVenta()
    const row = db.prepare('SELECT * FROM ventas WHERE id = ?').get(ventaId)
    return mapVenta(row as Record<string, unknown>)
  })

  handle('ventas:list', ({ turnoId, fecha }) => {
    const db = getSqlite()
    const conditions: string[] = []
    const params: unknown[] = []
    if (turnoId) { conditions.push('turno_id = ?'); params.push(turnoId) }
    if (fecha) { conditions.push("date(fecha) = date(?)"); params.push(fecha) }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const rows = db.prepare(`SELECT * FROM ventas ${where} ORDER BY fecha DESC`).all(...params)
    return rows.map(r => mapVenta(r as Record<string, unknown>))
  })

  handle('ventas:get', ({ id }) => {
    const db = getSqlite()
    const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(id) as Record<string, unknown> | undefined
    if (!venta) throw new Error(`Venta ${id} no encontrada`)

    const items = db.prepare(`
      SELECT iv.*, p.nombre as nombre_producto
      FROM items_venta iv JOIN productos p ON p.id = iv.producto_id
      WHERE iv.venta_id = ?
    `).all(id) as Record<string, unknown>[]

    const pagos = db.prepare('SELECT * FROM pagos_venta WHERE venta_id = ?').all(id) as Record<string, unknown>[]

    return {
      ...mapVenta(venta),
      items: items.map(i => ({
        productoId: i.producto_id as number,
        cantidad: i.cantidad as number,
        precioUnitario: i.precio_unitario as number,
        descuento: i.descuento as number,
        subtotal: i.subtotal as number,
        pesable: Boolean(i.pesable),
        nombreProducto: i.nombre_producto as string,
      })),
      pagos: pagos.map(p => ({
        medioPago: p.medio_pago as import('../../shared/types').MedioPago,
        monto: p.monto as number,
        referencia: p.referencia as string | null,
      })),
    } as VentaDetalle
  })
}

function mapVenta(row: Record<string, unknown>): Venta {
  return {
    id: row.id as number,
    turnoId: row.turno_id as number,
    sucursalId: row.sucursal_id as number,
    usuarioId: row.usuario_id as number,
    clienteId: row.cliente_id as number | null,
    fecha: row.fecha as string,
    subtotal: row.subtotal as number,
    descuentoTotal: row.descuento_total as number,
    total: row.total as number,
    estado: row.estado as Venta['estado'],
    tipoComprobante: row.tipo_comprobante as Venta['tipoComprobante'],
    cae: row.cae as string | null,
    caeVencimiento: row.cae_vencimiento as string | null,
    numeroComprobante: row.numero_comprobante as string | null,
  }
}
