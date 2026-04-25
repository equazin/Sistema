import { handle } from './base'
import { getSqlite } from '../db/database'
import type { Proveedor, OrdenCompra, SugerenciaReorden } from '../../shared/types'
import { assertPermisoUsuario } from './permisos'
import { registrarAuditoria } from './auditoria'

export function registerProveedoresHandlers(): void {
  handle('proveedores:list', () => {
    const db = getSqlite()
    const rows = db.prepare('SELECT * FROM proveedores WHERE activo = 1 ORDER BY nombre').all() as Record<string, unknown>[]
    return rows.map(mapProveedor)
  })

  handle('proveedores:create', (data) => {
    const db = getSqlite()
    const result = db.prepare(`
      INSERT INTO proveedores (negocio_id, nombre, cuit, telefono, email, condicion_pago)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(data.negocioId, data.nombre, data.cuit ?? null, data.telefono ?? null, data.email ?? null, data.condicionPago ?? null)
    const row = db.prepare('SELECT * FROM proveedores WHERE id = ?').get(result.lastInsertRowid)
    return mapProveedor(row as Record<string, unknown>)
  })

  handle('proveedores:update', ({ id, ...data }) => {
    const db = getSqlite()
    db.prepare(`
      UPDATE proveedores
      SET nombre = ?, cuit = ?, telefono = ?, email = ?, condicion_pago = ?
      WHERE id = ?
    `).run(data.nombre, data.cuit ?? null, data.telefono ?? null, data.email ?? null, data.condicionPago ?? null, id)
    const row = db.prepare('SELECT * FROM proveedores WHERE id = ?').get(id)
    return mapProveedor(row as Record<string, unknown>)
  })

  handle('proveedores:delete', ({ id }) => {
    const db = getSqlite()
    db.prepare('UPDATE proveedores SET activo = 0 WHERE id = ?').run(id)
  })

  handle('compras:list', ({ proveedorId }) => {
    const db = getSqlite()
    const rows = proveedorId
      ? db.prepare(`
          SELECT c.*, p.nombre AS nombre_proveedor
          FROM compras c JOIN proveedores p ON p.id = c.proveedor_id
          WHERE c.proveedor_id = ? ORDER BY c.fecha DESC
        `).all(proveedorId) as Record<string, unknown>[]
      : db.prepare(`
          SELECT c.*, p.nombre AS nombre_proveedor
          FROM compras c JOIN proveedores p ON p.id = c.proveedor_id
          ORDER BY c.fecha DESC LIMIT 50
        `).all() as Record<string, unknown>[]
    return rows.map(mapCompra)
  })

  handle('compras:crear', (data) => {
    const db = getSqlite()
    assertPermisoUsuario(db, data.usuarioId, 'compras:gestionar')
    const crearOC = db.transaction(() => {
      const total = data.items.reduce((s, i) => s + i.subtotal, 0)
      const result = db.prepare(`
        INSERT INTO compras (proveedor_id, usuario_id, total)
        VALUES (?, ?, ?)
      `).run(data.proveedorId, data.usuarioId, total)
      const compraId = result.lastInsertRowid as number

      const itemStmt = db.prepare(`
        INSERT INTO items_compra (compra_id, producto_id, cantidad, precio_unitario, subtotal)
        VALUES (?, ?, ?, ?, ?)
      `)
      for (const item of data.items) {
        itemStmt.run(compraId, item.productoId, item.cantidad, item.precioUnitario, item.subtotal)
      }
      registrarAuditoria(db, {
        usuarioId: data.usuarioId,
        accion: 'orden_compra_creada',
        tabla: 'compras',
        referenciaId: compraId,
        detalle: { proveedorId: data.proveedorId, total, items: data.items.length },
      })
      return compraId
    })
    const compraId = crearOC()
    const row = db.prepare(`
      SELECT c.*, p.nombre AS nombre_proveedor FROM compras c
      JOIN proveedores p ON p.id = c.proveedor_id WHERE c.id = ?
    `).get(compraId)
    return mapCompra(row as Record<string, unknown>)
  })

  handle('compras:recibir', ({ compraId, usuarioId }) => {
    const db = getSqlite()
    assertPermisoUsuario(db, usuarioId, 'compras:gestionar')
    const recibir = db.transaction(() => {
      const compra = db.prepare('SELECT * FROM compras WHERE id = ?').get(compraId) as Record<string, unknown> | undefined
      if (!compra) throw new Error('Orden de compra no encontrada')
      if (compra.estado === 'recibida') throw new Error('Ya fue recibida')

      const items = db.prepare('SELECT * FROM items_compra WHERE compra_id = ?').all(compraId) as Record<string, unknown>[]

      const stockStmt = db.prepare(`
        UPDATE productos SET stock_actual = stock_actual + ?, updated_at = datetime('now','localtime')
        WHERE id = ?
      `)
      const movStmt = db.prepare(`
        INSERT INTO movimientos_stock (producto_id, tipo, cantidad, cantidad_anterior, motivo, referencia_id, referencia_tipo, usuario_id)
        SELECT ?, 'entrada', ?, stock_actual - ?, 'compra', ?, 'compra', ?
        FROM productos WHERE id = ?
      `)

      for (const item of items) {
        const cant = item.cantidad as number
        const pid = item.producto_id as number
        movStmt.run(pid, cant, cant, compraId, usuarioId, pid)
        stockStmt.run(cant, pid)
      }

      db.prepare("UPDATE compras SET estado = 'recibida' WHERE id = ?").run(compraId)
      registrarAuditoria(db, {
        usuarioId,
        accion: 'orden_compra_recibida',
        tabla: 'compras',
        referenciaId: compraId,
        detalle: { items: items.length },
      })
    })
    recibir()
  })

  handle('compras:get', ({ id }) => {
    const db = getSqlite()
    const compra = db.prepare(`
      SELECT c.*, p.nombre AS nombre_proveedor FROM compras c
      JOIN proveedores p ON p.id = c.proveedor_id WHERE c.id = ?
    `).get(id) as Record<string, unknown> | undefined
    if (!compra) throw new Error('Compra no encontrada')

    const items = db.prepare(`
      SELECT ic.*, p.nombre AS nombre_producto FROM items_compra ic
      JOIN productos p ON p.id = ic.producto_id WHERE ic.compra_id = ?
    `).all(id) as Record<string, unknown>[]

    return {
      ...mapCompra(compra),
      items: items.map(i => ({
        productoId: i.producto_id as number,
        nombreProducto: i.nombre_producto as string,
        cantidad: i.cantidad as number,
        precioUnitario: i.precio_unitario as number,
        subtotal: i.subtotal as number,
      })),
    }
  })

  handle('compras:sugerenciasReorden', ({ proveedorId, categoriaId }) => {
    const db = getSqlite()
    const filtros: string[] = []
    const params: number[] = []

    if (proveedorId) {
      filtros.push('prov.id = ?')
      params.push(proveedorId)
    }
    if (categoriaId) {
      filtros.push('p.categoria_id = ?')
      params.push(categoriaId)
    }

    const rows = db.prepare(`
      SELECT
        p.id AS producto_id,
        p.nombre AS nombre_producto,
        p.stock_actual,
        p.stock_minimo,
        p.stock_maximo,
        p.precio_costo,
        prov.id AS proveedor_id,
        prov.nombre AS nombre_proveedor
      FROM productos p
      LEFT JOIN productos_proveedores pp ON pp.producto_id = p.id
      LEFT JOIN proveedores prov ON prov.id = pp.proveedor_id AND COALESCE(prov.activo, 1) = 1
      WHERE p.activo = 1
        AND p.stock_minimo > 0
        AND p.stock_actual <= p.stock_minimo
        ${filtros.length > 0 ? `AND ${filtros.join(' AND ')}` : ''}
      ORDER BY prov.nombre IS NULL, prov.nombre, p.nombre
    `).all(...params) as Record<string, unknown>[]

    const vistos = new Set<number>()
    const sugerencias: SugerenciaReorden[] = []

    for (const row of rows) {
      const productoId = row.producto_id as number
      if (vistos.has(productoId)) continue
      vistos.add(productoId)

      const stockActual = row.stock_actual as number
      const stockMinimo = row.stock_minimo as number
      const stockMaximo = row.stock_maximo as number | null
      const objetivo = stockMaximo && stockMaximo > stockMinimo ? stockMaximo : stockMinimo
      const cantidadSugerida = Math.max(1, Math.ceil(objetivo - stockActual))

      sugerencias.push({
        productoId,
        nombreProducto: row.nombre_producto as string,
        stockActual,
        stockMinimo,
        stockMaximo,
        cantidadSugerida,
        precioCosto: row.precio_costo as number,
        proveedorId: row.proveedor_id as number | null,
        nombreProveedor: row.nombre_proveedor as string | null,
      })
    }

    return sugerencias
  })
}

function mapProveedor(row: Record<string, unknown>): Proveedor {
  return {
    id: row.id as number,
    negocioId: row.negocio_id as number,
    nombre: row.nombre as string,
    cuit: row.cuit as string | null,
    telefono: row.telefono as string | null,
    email: row.email as string | null,
    condicionPago: row.condicion_pago as string | null,
    activo: Boolean(row.activo ?? 1),
  }
}

function mapCompra(row: Record<string, unknown>): OrdenCompra {
  return {
    id: row.id as number,
    proveedorId: row.proveedor_id as number,
    nombreProveedor: row.nombre_proveedor as string,
    usuarioId: row.usuario_id as number,
    fecha: row.fecha as string,
    total: row.total as number,
    estado: row.estado as OrdenCompra['estado'],
  }
}
