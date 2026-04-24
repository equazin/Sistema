import { handle } from './base'
import { getSqlite } from '../db/database'
import type { Proveedor, OrdenCompra } from '../../shared/types'

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
