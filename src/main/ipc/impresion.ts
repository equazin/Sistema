import { handle } from './base'
import { BrowserWindow } from 'electron'
import { getSqlite } from '../db/database'

export function registerImpresionHandlers(): void {
  handle('impresion:ticketVenta', ({ ventaId }) => {
    const db = getSqlite()

    const venta = db.prepare(`
      SELECT v.*, n.nombre AS nombre_negocio, n.domicilio, n.cuit, n.telefono
      FROM ventas v
      JOIN turnos_caja t ON t.id = v.turno_id
      JOIN cajas c ON c.id = t.caja_id
      JOIN sucursales s ON s.id = c.sucursal_id
      JOIN negocios n ON n.id = s.negocio_id
      WHERE v.id = ?
    `).get(ventaId) as Record<string, unknown> | undefined
    if (!venta) throw new Error('Venta no encontrada')

    const items = db.prepare(`
      SELECT iv.*, p.nombre AS nombre_producto, p.codigo_barras
      FROM items_venta iv JOIN productos p ON p.id = iv.producto_id
      WHERE iv.venta_id = ?
    `).all(ventaId) as Record<string, unknown>[]

    const pagos = db.prepare('SELECT * FROM pagos_venta WHERE venta_id = ?').all(ventaId) as Record<string, unknown>[]

    const html = buildTicketHTML({ venta, items, pagos, tipo: 'venta' })
    printHTML(html)
    return true
  })

  handle('impresion:ticketCierre', ({ turnoId }) => {
    const db = getSqlite()

    const turno = db.prepare(`
      SELECT t.*, u.nombre AS nombre_cajero, n.nombre AS nombre_negocio, n.cuit, n.domicilio
      FROM turnos_caja t
      JOIN usuarios u ON u.id = t.usuario_id
      JOIN cajas c ON c.id = t.caja_id
      JOIN sucursales s ON s.id = c.sucursal_id
      JOIN negocios n ON n.id = s.negocio_id
      WHERE t.id = ?
    `).get(turnoId) as Record<string, unknown> | undefined
    if (!turno) throw new Error('Turno no encontrado')

    const ventas = db.prepare(`
      SELECT v.total, v.estado FROM ventas v WHERE v.turno_id = ? AND v.estado = 'completada'
    `).all(turnoId) as Record<string, unknown>[]

    const mediosPago = db.prepare(`
      SELECT pv.medio_pago, SUM(pv.monto) as total
      FROM pagos_venta pv
      JOIN ventas v ON v.id = pv.venta_id
      WHERE v.turno_id = ? AND v.estado = 'completada'
      GROUP BY pv.medio_pago
    `).all(turnoId) as Record<string, unknown>[]

    const html = buildCierreHTML({ turno, ventas, mediosPago })
    printHTML(html)
    return true
  })
}

function printHTML(html: string): void {
  const win = new BrowserWindow({
    width: 400,
    height: 600,
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  })

  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  win.webContents.once('did-finish-load', () => {
    win.webContents.print({ silent: false, printBackground: true }, (success, error) => {
      if (!success && error) console.error('[Impresion]', error)
      win.close()
    })
  })
}

interface TicketData {
  venta: Record<string, unknown>
  items: Record<string, unknown>[]
  pagos: Record<string, unknown>[]
  tipo: 'venta'
}

function formatARS(n: number): string {
  return `$ ${n.toFixed(2).replace('.', ',')}`
}

function formatFechaTicket(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

const MEDIO_PAGO_LABELS: Record<string, string> = {
  efectivo: 'Efectivo',
  debito: 'Débito',
  credito: 'Crédito',
  transferencia: 'Transferencia',
  qr_mp: 'QR MercadoPago',
  cuenta_corriente: 'Cuenta Corriente',
}

function buildTicketHTML({ venta, items, pagos }: TicketData): string {
  const negocio = venta.nombre_negocio as string
  const cuit = venta.cuit as string
  const domicilio = venta.domicilio as string
  const telefono = venta.telefono as string | null
  const fecha = formatFechaTicket(venta.fecha as string)
  const ventaId = venta.id as number
  const subtotal = venta.subtotal as number
  const descuento = venta.descuento_total as number
  const total = venta.total as number

  const itemsHTML = items.map(i => `
    <tr>
      <td>${i.nombre_producto as string}</td>
      <td style="text-align:center">${i.cantidad as number}</td>
      <td style="text-align:right">${formatARS(i.precio_unitario as number)}</td>
      <td style="text-align:right">${formatARS(i.subtotal as number)}</td>
    </tr>
  `).join('')

  const pagosHTML = pagos.map(p => `
    <tr>
      <td>${MEDIO_PAGO_LABELS[p.medio_pago as string] ?? p.medio_pago as string}</td>
      <td style="text-align:right">${formatARS(p.monto as number)}</td>
    </tr>
  `).join('')

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; padding: 4mm; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .negocio { font-size: 14px; font-weight: bold; text-align: center; margin-bottom: 2px; }
  .separator { border-top: 1px dashed #000; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1px 2px; vertical-align: top; }
  .total-row td { font-weight: bold; font-size: 14px; border-top: 1px dashed #000; padding-top: 4px; }
  @media print {
    @page { margin: 0; size: 80mm auto; }
    body { width: 80mm; }
  }
</style>
</head>
<body>
  <p class="negocio">${negocio}</p>
  ${cuit ? `<p class="center">CUIT: ${cuit}</p>` : ''}
  ${domicilio ? `<p class="center">${domicilio}</p>` : ''}
  ${telefono ? `<p class="center">Tel: ${telefono}</p>` : ''}
  <div class="separator"></div>
  <p class="center bold">TICKET DE VENTA</p>
  <p class="center">#${ventaId} — ${fecha}</p>
  <div class="separator"></div>

  <table>
    <thead>
      <tr>
        <td class="bold">Producto</td>
        <td class="bold" style="text-align:center">Cant</td>
        <td class="bold" style="text-align:right">P.Unit</td>
        <td class="bold" style="text-align:right">Total</td>
      </tr>
    </thead>
    <tbody>${itemsHTML}</tbody>
  </table>

  <div class="separator"></div>
  <table>
    <tr><td>Subtotal</td><td style="text-align:right">${formatARS(subtotal)}</td></tr>
    ${descuento > 0 ? `<tr><td>Descuento</td><td style="text-align:right">- ${formatARS(descuento)}</td></tr>` : ''}
    <tr class="total-row"><td>TOTAL</td><td style="text-align:right">${formatARS(total)}</td></tr>
  </table>

  <div class="separator"></div>
  <p class="bold" style="margin-bottom:2px">Forma de pago:</p>
  <table>${pagosHTML}</table>

  <div class="separator"></div>
  <p class="center" style="margin-top:4px">¡Gracias por su compra!</p>
</body>
</html>`
}

function buildCierreHTML({
  turno,
  ventas,
  mediosPago,
}: {
  turno: Record<string, unknown>
  ventas: Record<string, unknown>[]
  mediosPago: Record<string, unknown>[]
}): string {
  const negocio = turno.nombre_negocio as string
  const cajero = turno.nombre_cajero as string
  const apertura = formatFechaTicket(turno.apertura_at as string)
  const cierre = turno.cierre_at ? formatFechaTicket(turno.cierre_at as string) : '—'
  const montoApertura = turno.monto_apertura as number
  const montoSistema = (turno.monto_cierre_sistema ?? 0) as number
  const montoDeclado = (turno.monto_cierre_declado ?? 0) as number
  const diferencia = (turno.diferencia ?? 0) as number
  const totalVentas = ventas.reduce((s, v) => s + (v.total as number), 0)

  const mediosHTML = mediosPago.map(m => `
    <tr>
      <td>${MEDIO_PAGO_LABELS[m.medio_pago as string] ?? m.medio_pago as string}</td>
      <td style="text-align:right">${formatARS(m.total as number)}</td>
    </tr>
  `).join('')

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; padding: 4mm; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .negocio { font-size: 14px; font-weight: bold; text-align: center; margin-bottom: 2px; }
  .separator { border-top: 1px dashed #000; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 2px; }
  @media print { @page { margin: 0; size: 80mm auto; } body { width: 80mm; } }
</style>
</head>
<body>
  <p class="negocio">${negocio}</p>
  <div class="separator"></div>
  <p class="center bold">CIERRE DE CAJA</p>
  <div class="separator"></div>
  <table>
    <tr><td>Cajero</td><td style="text-align:right">${cajero}</td></tr>
    <tr><td>Apertura</td><td style="text-align:right">${apertura}</td></tr>
    <tr><td>Cierre</td><td style="text-align:right">${cierre}</td></tr>
    <tr><td>Cant. ventas</td><td style="text-align:right">${ventas.length}</td></tr>
    <tr><td>Total recaudado</td><td style="text-align:right">${formatARS(totalVentas)}</td></tr>
  </table>
  <div class="separator"></div>
  <p class="bold">Por medio de pago:</p>
  <table>${mediosHTML}</table>
  <div class="separator"></div>
  <table>
    <tr><td>Apertura efectivo</td><td style="text-align:right">${formatARS(montoApertura)}</td></tr>
    <tr><td>Efectivo sistema</td><td style="text-align:right">${formatARS(montoSistema)}</td></tr>
    <tr><td>Efectivo declarado</td><td style="text-align:right">${formatARS(montoDeclado)}</td></tr>
    <tr>
      <td class="bold">Diferencia</td>
      <td class="bold" style="text-align:right">${diferencia >= 0 ? '+' : ''}${formatARS(diferencia)}</td>
    </tr>
  </table>
  <div class="separator"></div>
  <p class="center">Turno cerrado</p>
</body>
</html>`
}
