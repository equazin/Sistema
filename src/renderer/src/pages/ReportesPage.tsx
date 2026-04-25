import { useState, useCallback, useEffect } from 'react'
import { invoke } from '../lib/api'
import { Button } from '../components/ui/Button'
import { formatPrecio, formatFecha } from '../lib/format'
import type {
  FilaVentaReporte,
  GrupoVentasReporte,
  ResumenVentasReporte,
  RankingProducto,
  MedioPagoReporte,
  ProductoStockValorizado,
} from '../../../shared/types'

type Tab = 'ventas' | 'ranking' | 'medios_pago' | 'stock'
type AgruparPor = 'dia' | 'semana' | 'mes'

const hoy = new Date().toISOString().slice(0, 10)
const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

const LABELS_MEDIO_PAGO: Record<string, string> = {
  efectivo: 'Efectivo',
  debito: 'Débito',
  credito: 'Crédito',
  transferencia: 'Transferencia',
  qr_mp: 'QR MercadoPago',
  cuenta_corriente: 'Cuenta Corriente',
}

export function ReportesPage(): JSX.Element {
  const [tab, setTab] = useState<Tab>('ventas')
  const [desde, setDesde] = useState(inicioMes)
  const [hasta, setHasta] = useState(hoy)
  const [agruparPor, setAgruparPor] = useState<AgruparPor>('dia')
  const [isLoading, setIsLoading] = useState(false)

  // Ventas
  const [grupos, setGrupos] = useState<GrupoVentasReporte[]>([])
  const [filas, setFilas] = useState<FilaVentaReporte[]>([])
  const [resumen, setResumen] = useState<ResumenVentasReporte | null>(null)

  // Ranking
  const [ranking, setRanking] = useState<RankingProducto[]>([])

  // Medios de pago
  const [medios, setMedios] = useState<MedioPagoReporte[]>([])

  // Stock valorizado
  const [stockData, setStockData] = useState<{ productos: ProductoStockValorizado[]; totalValorCosto: number; totalValorVenta: number } | null>(null)

  const cargarVentas = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await invoke('reportes:ventas', { desde, hasta, agruparPor })
      setGrupos(res.grupos)
      setFilas(res.filas)
      setResumen(res.resumen)
    } finally {
      setIsLoading(false)
    }
  }, [desde, hasta, agruparPor])

  const cargarRanking = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await invoke('reportes:ranking', { desde, hasta, limit: 20 })
      setRanking(res)
    } finally {
      setIsLoading(false)
    }
  }, [desde, hasta])

  const cargarMedios = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await invoke('reportes:porMedioPago', { desde, hasta })
      setMedios(res)
    } finally {
      setIsLoading(false)
    }
  }, [desde, hasta])

  const cargarStock = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await invoke('reportes:stockValorizado', {})
      setStockData(res)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tab === 'ventas') cargarVentas()
    else if (tab === 'ranking') cargarRanking()
    else if (tab === 'medios_pago') cargarMedios()
    else if (tab === 'stock') cargarStock()
  }, [tab])

  const exportarCSV = useCallback(() => {
    let csv = ''
    let filename = ''

    if (tab === 'ventas') {
      csv = 'Período,Cantidad,Total,Descuentos\n'
      csv += grupos.map(g => `${g.periodo},${g.cantidad},${g.total.toFixed(2)},${g.descuentos.toFixed(2)}`).join('\n')
      filename = `ventas_${desde}_${hasta}.csv`
    } else if (tab === 'ranking') {
      csv = 'Posición,Producto,Cantidad Vendida,Total Vendido\n'
      csv += ranking.map(r => `${r.posicion},"${r.nombre}",${r.cantidadVendida},${r.totalVendido.toFixed(2)}`).join('\n')
      filename = `ranking_${desde}_${hasta}.csv`
    } else if (tab === 'medios_pago') {
      csv = 'Medio de Pago,Cantidad,Total\n'
      csv += medios.map(m => `${LABELS_MEDIO_PAGO[m.medioPago] ?? m.medioPago},${m.cantidad},${m.total.toFixed(2)}`).join('\n')
      filename = `medios_pago_${desde}_${hasta}.csv`
    } else if (tab === 'stock' && stockData) {
      csv = 'Producto,Categoría,Stock,Mínimo,Precio Costo,Precio Venta,Valor Costo,Valor Venta\n'
      csv += stockData.productos.map(p =>
        `"${p.nombre}","${p.categoria ?? ''}",${p.stockActual},${p.stockMinimo},${p.precioCosto.toFixed(2)},${p.precioVenta.toFixed(2)},${p.valorCosto.toFixed(2)},${p.valorVenta.toFixed(2)}`
      ).join('\n')
      filename = `stock_valorizado.csv`
    }

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }, [tab, grupos, ranking, medios, stockData, desde, hasta])

  const exportarXLS = useCallback(() => {
    let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"/></head><body>'
    let filename = ''

    const td = (v: string | number, bold = false) =>
      `<td${bold ? ' style="font-weight:bold"' : ''}>${String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</td>`

    if (tab === 'ventas') {
      filename = `ventas_${desde}_${hasta}.xls`
      html += '<table><tr><th>Período</th><th>Ventas</th><th>Descuentos</th><th>Total</th></tr>'
      html += grupos.map(g =>
        `<tr>${td(g.periodo)}${td(g.cantidad)}${td(g.descuentos.toFixed(2))}${td(g.total.toFixed(2), true)}</tr>`
      ).join('')
      if (resumen) {
        html += `<tr><td></td><td></td><td style="font-weight:bold">TOTAL</td>${td(resumen.totalRecaudado.toFixed(2), true)}</tr>`
      }
      html += '</table>'
    } else if (tab === 'ranking') {
      filename = `ranking_${desde}_${hasta}.xls`
      html += '<table><tr><th>#</th><th>Producto</th><th>Código de barras</th><th>Cantidad vendida</th><th>Apariciones</th><th>Total</th></tr>'
      html += ranking.map(r =>
        `<tr>${td(r.posicion)}${td(r.nombre)}${td(r.codigoBarras ?? '')}${td(r.cantidadVendida)}${td(r.apariciones)}${td(r.totalVendido.toFixed(2), true)}</tr>`
      ).join('')
      html += '</table>'
    } else if (tab === 'medios_pago') {
      filename = `medios_pago_${desde}_${hasta}.xls`
      const totalGeneral = medios.reduce((s, m) => s + m.total, 0)
      html += '<table><tr><th>Medio de pago</th><th>Transacciones</th><th>Total</th><th>%</th></tr>'
      html += medios.map(m =>
        `<tr>${td(LABELS_MEDIO_PAGO[m.medioPago] ?? m.medioPago)}${td(m.cantidad)}${td(m.total.toFixed(2), true)}${td(totalGeneral > 0 ? ((m.total / totalGeneral) * 100).toFixed(1) + '%' : '—')}</tr>`
      ).join('')
      html += `<tr><td style="font-weight:bold">TOTAL</td><td></td>${td(totalGeneral.toFixed(2), true)}<td>100%</td></tr>`
      html += '</table>'
    } else if (tab === 'stock' && stockData) {
      filename = `stock_valorizado.xls`
      html += '<table><tr><th>Producto</th><th>Categoría</th><th>Stock actual</th><th>Stock mínimo</th><th>Precio costo</th><th>Precio venta</th><th>Valor costo</th><th>Valor venta</th></tr>'
      html += stockData.productos.map(p =>
        `<tr>${td(p.nombre)}${td(p.categoria ?? '')}${td(p.stockActual)}${td(p.stockMinimo)}${td(p.precioCosto.toFixed(2))}${td(p.precioVenta.toFixed(2))}${td(p.valorCosto.toFixed(2))}${td(p.valorVenta.toFixed(2), true)}</tr>`
      ).join('')
      html += `<tr><td colspan="6" style="font-weight:bold">TOTALES</td>${td(stockData.totalValorCosto.toFixed(2), true)}${td(stockData.totalValorVenta.toFixed(2), true)}</tr>`
      html += '</table>'
    }

    html += '</body></html>'
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }, [tab, grupos, ranking, medios, stockData, resumen, desde, hasta])

  const TABS: { key: Tab; label: string }[] = [
    { key: 'ventas', label: 'Ventas' },
    { key: 'ranking', label: 'Ranking productos' },
    { key: 'medios_pago', label: 'Medios de pago' },
    { key: 'stock', label: 'Stock valorizado' },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Reportes</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportarCSV} size="sm">Exportar CSV</Button>
          <Button variant="outline" onClick={exportarXLS} size="sm">Exportar Excel</Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filtros de fecha (no aplican a stock) */}
      {tab !== 'stock' && (
        <div className="flex items-center gap-4 bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-500 font-medium">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={e => setDesde(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-500 font-medium">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={e => setHasta(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
            />
          </div>
          {tab === 'ventas' && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-500 font-medium">Agrupar por</label>
              <select
                value={agruparPor}
                onChange={e => setAgruparPor(e.target.value as AgruparPor)}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
              >
                <option value="dia">Día</option>
                <option value="semana">Semana</option>
                <option value="mes">Mes</option>
              </select>
            </div>
          )}
          <Button
            onClick={() => {
              if (tab === 'ventas') cargarVentas()
              else if (tab === 'ranking') cargarRanking()
              else if (tab === 'medios_pago') cargarMedios()
            }}
            disabled={isLoading}
            size="sm"
          >
            {isLoading ? 'Cargando...' : 'Actualizar'}
          </Button>
        </div>
      )}

      {/* Contenido de cada tab */}
      {tab === 'ventas' && resumen && (
        <div className="flex flex-col gap-4">
          {/* Resumen cards */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Total de ventas" value={String(resumen.totalVentas)} />
            <StatCard label="Total recaudado" value={formatPrecio(resumen.totalRecaudado)} />
            <StatCard label="Ticket promedio" value={formatPrecio(resumen.ticketPromedio)} />
            <StatCard label="Total descuentos" value={formatPrecio(resumen.totalDescuentos)} />
          </div>

          {/* Grupos */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-slate-600 font-semibold">Período</th>
                  <th className="text-right px-4 py-3 text-slate-600 font-semibold">Ventas</th>
                  <th className="text-right px-4 py-3 text-slate-600 font-semibold">Descuentos</th>
                  <th className="text-right px-4 py-3 text-slate-600 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {grupos.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-8 text-slate-400">Sin datos en el período seleccionado</td></tr>
                )}
                {grupos.map(g => (
                  <tr key={g.periodo} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-700">{g.periodo}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{g.cantidad}</td>
                    <td className="px-4 py-3 text-right text-red-500">− {formatPrecio(g.descuentos)}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">{formatPrecio(g.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Detalle individual */}
          {filas.length > 0 && (
            <details className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <summary className="px-4 py-3 text-sm font-semibold text-slate-700 cursor-pointer select-none hover:bg-slate-50">
                Ver detalle ({filas.length} ventas)
              </summary>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-2 text-slate-600">#</th>
                    <th className="text-left px-4 py-2 text-slate-600">Fecha</th>
                    <th className="text-left px-4 py-2 text-slate-600">Vendedor</th>
                    <th className="text-left px-4 py-2 text-slate-600">Comprobante</th>
                    <th className="text-right px-4 py-2 text-slate-600">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map(f => (
                    <tr key={f.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-2 text-slate-500">#{f.id}</td>
                      <td className="px-4 py-2 text-slate-600">{formatFecha(f.fecha)}</td>
                      <td className="px-4 py-2 text-slate-600">{f.nombreUsuario}</td>
                      <td className="px-4 py-2 text-slate-500 capitalize">{f.tipoComprobante}</td>
                      <td className="px-4 py-2 text-right font-semibold">{formatPrecio(f.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </div>
      )}

      {tab === 'ranking' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-slate-600 font-semibold">#</th>
                <th className="text-left px-4 py-3 text-slate-600 font-semibold">Producto</th>
                <th className="text-right px-4 py-3 text-slate-600 font-semibold">Cantidad</th>
                <th className="text-right px-4 py-3 text-slate-600 font-semibold">Ventas</th>
                <th className="text-right px-4 py-3 text-slate-600 font-semibold">Total facturado</th>
              </tr>
            </thead>
            <tbody>
              {ranking.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-slate-400">Sin datos</td></tr>
              )}
              {ranking.map(r => (
                <tr key={r.productoId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <span className={`font-bold ${r.posicion <= 3 ? 'text-yellow-500' : 'text-slate-400'}`}>
                      {r.posicion <= 1 ? '🥇' : r.posicion <= 2 ? '🥈' : r.posicion <= 3 ? '🥉' : `#${r.posicion}`}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{r.nombre}</p>
                    {r.codigoBarras && <p className="text-xs text-slate-400">{r.codigoBarras}</p>}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">{r.cantidadVendida}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{r.apariciones}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">{formatPrecio(r.totalVendido)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'medios_pago' && (
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-slate-600 font-semibold">Medio de pago</th>
                  <th className="text-right px-4 py-3 text-slate-600 font-semibold">Transacciones</th>
                  <th className="text-right px-4 py-3 text-slate-600 font-semibold">Total recaudado</th>
                  <th className="text-right px-4 py-3 text-slate-600 font-semibold">%</th>
                </tr>
              </thead>
              <tbody>
                {medios.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-8 text-slate-400">Sin datos</td></tr>
                )}
                {(() => {
                  const totalGeneral = medios.reduce((s, m) => s + m.total, 0)
                  return medios.map(m => (
                    <tr key={m.medioPago} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{LABELS_MEDIO_PAGO[m.medioPago] ?? m.medioPago}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{m.cantidad}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">{formatPrecio(m.total)}</td>
                      <td className="px-4 py-3 text-right text-slate-500">
                        {totalGeneral > 0 ? `${((m.total / totalGeneral) * 100).toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  ))
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'stock' && stockData && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="Valor de stock (costo)" value={formatPrecio(stockData.totalValorCosto)} />
            <StatCard label="Valor de stock (venta)" value={formatPrecio(stockData.totalValorVenta)} />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-slate-600 font-semibold">Producto</th>
                  <th className="text-left px-4 py-3 text-slate-600 font-semibold">Categoría</th>
                  <th className="text-right px-4 py-3 text-slate-600 font-semibold">Stock</th>
                  <th className="text-right px-4 py-3 text-slate-600 font-semibold">Valor costo</th>
                  <th className="text-right px-4 py-3 text-slate-600 font-semibold">Valor venta</th>
                </tr>
              </thead>
              <tbody>
                {stockData.productos.map(p => (
                  <tr key={p.id} className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 ${p.bajoMinimo ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{p.nombre}</p>
                      {p.bajoMinimo && <span className="text-xs text-red-500 font-semibold">⚠ Stock bajo</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{p.categoria ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={p.bajoMinimo ? 'text-red-600 font-bold' : 'text-slate-700'}>{p.stockActual}</span>
                      <span className="text-slate-400 text-xs ml-1">/ mín {p.stockMinimo}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatPrecio(p.valorCosto)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatPrecio(p.valorVenta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
    </div>
  )
}
