import { handle } from './base'
import { getSqlite } from '../db/database'

export function registerReportesHandlers(): void {
  handle('reportes:ventas', ({ desde, hasta, agruparPor }) => {
    const db = getSqlite()

    const filas = db.prepare(`
      SELECT
        v.id,
        v.fecha,
        v.total,
        v.subtotal,
        v.descuento_total,
        v.tipo_comprobante,
        v.estado,
        v.usuario_id,
        u.nombre AS nombre_usuario
      FROM ventas v
      LEFT JOIN usuarios u ON u.id = v.usuario_id
      WHERE date(v.fecha) >= date(?)
        AND date(v.fecha) <= date(?)
        AND v.estado = 'completada'
      ORDER BY v.fecha ASC
    `).all(desde, hasta) as Record<string, unknown>[]

    // Agrupar por día, semana o mes
    const grupos: Record<string, { periodo: string; total: number; cantidad: number; subtotal: number; descuentos: number }> = {}
    for (const f of filas) {
      const fecha = String(f.fecha)
      let periodo: string
      if (agruparPor === 'mes') {
        periodo = fecha.slice(0, 7) // YYYY-MM
      } else if (agruparPor === 'semana') {
        const d = new Date(fecha)
        const dow = d.getDay() === 0 ? 7 : d.getDay()
        const lunes = new Date(d)
        lunes.setDate(d.getDate() - dow + 1)
        periodo = lunes.toISOString().slice(0, 10)
      } else {
        periodo = fecha.slice(0, 10)
      }
      if (!grupos[periodo]) grupos[periodo] = { periodo, total: 0, cantidad: 0, subtotal: 0, descuentos: 0 }
      grupos[periodo].total += f.total as number
      grupos[periodo].cantidad += 1
      grupos[periodo].subtotal += f.subtotal as number
      grupos[periodo].descuentos += f.descuento_total as number
    }

    const ventasTotales = filas.reduce((s, f) => s + (f.total as number), 0)
    const ticketPromedio = filas.length > 0 ? ventasTotales / filas.length : 0

    return {
      filas: filas.map(f => ({
        id: f.id as number,
        fecha: f.fecha as string,
        total: f.total as number,
        subtotal: f.subtotal as number,
        descuentoTotal: f.descuento_total as number,
        tipoComprobante: f.tipo_comprobante as string,
        estado: f.estado as string,
        usuarioId: f.usuario_id as number,
        nombreUsuario: f.nombre_usuario as string,
      })),
      grupos: Object.values(grupos).sort((a, b) => a.periodo.localeCompare(b.periodo)),
      resumen: {
        totalVentas: filas.length,
        totalRecaudado: ventasTotales,
        ticketPromedio,
        totalDescuentos: filas.reduce((s, f) => s + (f.descuento_total as number), 0),
      },
    }
  })

  handle('reportes:ranking', ({ desde, hasta, limit }) => {
    const db = getSqlite()
    const rows = db.prepare(`
      SELECT
        p.id,
        p.nombre,
        p.codigo_barras,
        p.precio_venta,
        SUM(iv.cantidad) AS cantidad_vendida,
        SUM(iv.subtotal) AS total_vendido,
        COUNT(DISTINCT iv.venta_id) AS apariciones
      FROM items_venta iv
      JOIN productos p ON p.id = iv.producto_id
      JOIN ventas v ON v.id = iv.venta_id
      WHERE date(v.fecha) >= date(?)
        AND date(v.fecha) <= date(?)
        AND v.estado = 'completada'
      GROUP BY p.id
      ORDER BY total_vendido DESC
      LIMIT ?
    `).all(desde, hasta, limit ?? 20) as Record<string, unknown>[]

    return rows.map((r, i) => ({
      posicion: i + 1,
      productoId: r.id as number,
      nombre: r.nombre as string,
      codigoBarras: r.codigo_barras as string | null,
      precioVenta: r.precio_venta as number,
      cantidadVendida: r.cantidad_vendida as number,
      totalVendido: r.total_vendido as number,
      apariciones: r.apariciones as number,
    }))
  })

  handle('reportes:porMedioPago', ({ desde, hasta }) => {
    const db = getSqlite()
    const rows = db.prepare(`
      SELECT
        pv.medio_pago,
        COUNT(DISTINCT pv.venta_id) AS cantidad,
        SUM(pv.monto) AS total
      FROM pagos_venta pv
      JOIN ventas v ON v.id = pv.venta_id
      WHERE date(v.fecha) >= date(?)
        AND date(v.fecha) <= date(?)
        AND v.estado = 'completada'
      GROUP BY pv.medio_pago
      ORDER BY total DESC
    `).all(desde, hasta) as Record<string, unknown>[]

    return rows.map(r => ({
      medioPago: r.medio_pago as string,
      cantidad: r.cantidad as number,
      total: r.total as number,
    }))
  })

  handle('reportes:cuentaCorriente', ({ desde, hasta, clienteId }) => {
    const db = getSqlite()

    const filas = db.prepare(`
      SELECT
        c.id AS cliente_id,
        c.nombre AS nombre_cliente,
        c.saldo_cuenta_corriente AS saldo_actual,
        c.limite_credito,
        COALESCE(SUM(CASE WHEN v.estado = 'completada' THEN pv.monto ELSE 0 END), 0) AS total_vendido,
        COALESCE(co.total_cobrado, 0) AS total_cobrado,
        COUNT(DISTINCT CASE WHEN v.estado = 'completada' THEN v.id END) AS cantidad_ventas
      FROM clientes c
      LEFT JOIN ventas v ON v.cliente_id = c.id
        AND date(v.fecha) >= date(?) AND date(v.fecha) <= date(?)
      LEFT JOIN pagos_venta pv ON pv.venta_id = v.id AND pv.medio_pago = 'cuenta_corriente'
      LEFT JOIN (
        SELECT cliente_id, SUM(monto) AS total_cobrado
        FROM cobranzas
        WHERE date(fecha) >= date(?) AND date(fecha) <= date(?)
        GROUP BY cliente_id
      ) co ON co.cliente_id = c.id
      WHERE c.activo = 1 ${clienteId ? 'AND c.id = ?' : ''}
      GROUP BY c.id
      HAVING total_vendido > 0 OR COALESCE(co.total_cobrado, 0) > 0 OR c.saldo_cuenta_corriente > 0
      ORDER BY c.saldo_cuenta_corriente DESC
    `).all(desde, hasta, desde, hasta, ...(clienteId ? [clienteId] : [])) as Record<string, unknown>[]

    return {
      filas: filas.map(f => ({
        clienteId: f.cliente_id as number,
        nombreCliente: f.nombre_cliente as string,
        saldoActual: f.saldo_actual as number,
        limiteCredito: f.limite_credito as number,
        totalVendidoPeriodo: f.total_vendido as number,
        totalCobradoPeriodo: f.total_cobrado as number,
        cantidadVentas: f.cantidad_ventas as number,
      })),
      resumen: {
        totalDeuda: filas.reduce((s, f) => s + (f.saldo_actual as number), 0),
        totalCobrado: filas.reduce((s, f) => s + (f.total_cobrado as number), 0),
        saldoFinal: filas.reduce((s, f) => s + (f.saldo_actual as number), 0),
        clientesConDeuda: filas.filter(f => (f.saldo_actual as number) > 0).length,
      },
    }
  })

  handle('reportes:multisucursal', ({ desde, hasta }) => {
    const db = getSqlite()
    const rows = db.prepare(`
      SELECT
        s.id AS sucursal_id,
        s.nombre AS nombre_sucursal,
        COUNT(v.id) AS cantidad_ventas,
        COALESCE(SUM(v.total), 0) AS total_ventas
      FROM sucursales s
      LEFT JOIN cajas c ON c.sucursal_id = s.id
      LEFT JOIN turnos_caja t ON t.caja_id = c.id
      LEFT JOIN ventas v ON v.turno_id = t.id AND v.estado = 'completada' AND v.fecha BETWEEN ? AND ?
      WHERE s.activa = 1
      GROUP BY s.id
      ORDER BY total_ventas DESC
    `).all(desde, hasta) as Record<string, unknown>[]

    const porSucursal = rows.map(r => ({
      sucursalId: r.sucursal_id as number,
      nombreSucursal: r.nombre_sucursal as string,
      totalVentas: r.total_ventas as number,
      cantidadVentas: r.cantidad_ventas as number,
      ticketPromedio: (r.cantidad_ventas as number) > 0 ? (r.total_ventas as number) / (r.cantidad_ventas as number) : 0,
    }))

    const totalVentas = porSucursal.reduce((s, r) => s + r.totalVentas, 0)
    const cantidadVentas = porSucursal.reduce((s, r) => s + r.cantidadVentas, 0)
    return {
      porSucursal,
      totales: {
        totalVentas,
        cantidadVentas,
        ticketPromedio: cantidadVentas > 0 ? totalVentas / cantidadVentas : 0,
      },
    }
  })

  handle('reportes:stockValorizado', () => {
    const db = getSqlite()
    const rows = db.prepare(`
      SELECT
        p.id,
        p.nombre,
        p.codigo_barras,
        p.stock_actual,
        p.stock_minimo,
        p.precio_costo,
        p.precio_venta,
        c.nombre AS categoria
      FROM productos p
      LEFT JOIN categorias c ON c.id = p.categoria_id
      WHERE p.activo = 1
      ORDER BY (p.stock_actual * p.precio_costo) DESC
    `).all() as Record<string, unknown>[]

    const total = rows.reduce((s, r) => s + (r.stock_actual as number) * (r.precio_costo as number), 0)

    return {
      productos: rows.map(r => ({
        id: r.id as number,
        nombre: r.nombre as string,
        codigoBarras: r.codigo_barras as string | null,
        categoria: r.categoria as string | null,
        stockActual: r.stock_actual as number,
        stockMinimo: r.stock_minimo as number,
        precioCosto: r.precio_costo as number,
        precioVenta: r.precio_venta as number,
        valorCosto: (r.stock_actual as number) * (r.precio_costo as number),
        valorVenta: (r.stock_actual as number) * (r.precio_venta as number),
        bajoMinimo: (r.stock_actual as number) < (r.stock_minimo as number),
      })),
      totalValorCosto: total,
      totalValorVenta: rows.reduce((s, r) => s + (r.stock_actual as number) * (r.precio_venta as number), 0),
    }
  })
}
