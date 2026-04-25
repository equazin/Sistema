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
  FilaCuentaCorrienteReporte,
} from '../../../shared/types'

type Tab = 'ventas' | 'ranking' | 'medios_pago' | 'stock' | 'cuenta_corriente'
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

  // Cuenta corriente
  const [ccData, setCcData] = useState<{ filas: FilaCuentaCorrienteReporte[]; resumen: { totalDeuda: number; totalCobrado: number; saldoFinal: number; clientesConDeuda: number } } | null>(null)

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

  const cargarCC = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await invoke('reportes:cuentaCorriente', { desde, hasta })
      setCcData(res)
    } finally {
      setIsLoading(false)
    }
  }, [desde, hasta])

  useEffect(() => {
    if (tab === 'ventas') cargarVentas()
    else if (tab === 'ranking') cargarRanking()
    else if (tab === 'medios_pago') cargarMedios()
    else if (tab === 'stock') cargarStock()
    else if (tab === 'cuenta_corriente') cargarCC()
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
    } else if (tab === 'cuenta_corriente' && ccData) {
      csv = 'Cliente,Saldo actual,Límite crédito,Vendido periodo,Cobrado periodo,Ventas\n'
      csv += ccData.filas.map(f =>
        `"${f.nombreCliente}",${f.saldoActual.toFixed(2)},${f.limiteCredito.toFixed(2)},${f.totalVendidoPeriodo.toFixed(2)},${f.totalCobradoPeriodo.toFixed(2)},${f.cantidadVentas}`
      ).join('\n')
      filename = `cuenta_corriente_${desde}_${hasta}.csv`
    }

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }, [tab, grupos, ranking, medios, stockData, desde, hasta])

  const exportarXLS = useCallback(async () => {
    const XLSX = await import('xlsx')
    const workbook = XLSX.utils.book_new()
    let rows: (string | number)[][] = []
    let filename = ''
    let sheetName = ''

    if (tab === 'ventas') {
      filename = `ventas_${desde}_${hasta}.xlsx`
      sheetName = 'Ventas'
      rows = [
        ['Periodo', 'Ventas', 'Descuentos', 'Total'],
        ...grupos.map(g => [g.periodo, g.cantidad, g.descuentos, g.total]),
      ]
      if (resumen) {
        rows.push([])
        rows.push(['Resumen', '', '', ''])
        rows.push(['Total ventas', resumen.totalVentas, '', ''])
        rows.push(['Total recaudado', resumen.totalRecaudado, '', ''])
        rows.push(['Ticket promedio', resumen.ticketPromedio, '', ''])
        rows.push(['Total descuentos', resumen.totalDescuentos, '', ''])
      }
    } else if (tab === 'ranking') {
      filename = `ranking_${desde}_${hasta}.xlsx`
      sheetName = 'Ranking'
      rows = [
        ['Posicion', 'Producto', 'Codigo de barras', 'Cantidad vendida', 'Apariciones', 'Total'],
        ...ranking.map(r => [r.posicion, r.nombre, r.codigoBarras ?? '', r.cantidadVendida, r.apariciones, r.totalVendido]),
      ]
    } else if (tab === 'medios_pago') {
      filename = `medios_pago_${desde}_${hasta}.xlsx`
      sheetName = 'Medios de pago'
      const totalGeneral = medios.reduce((s, m) => s + m.total, 0)
      rows = [
        ['Medio de pago', 'Transacciones', 'Total', 'Porcentaje'],
        ...medios.map(m => [
          LABELS_MEDIO_PAGO[m.medioPago] ?? m.medioPago,
          m.cantidad,
          m.total,
          totalGeneral > 0 ? m.total / totalGeneral : 0,
        ]),
        ['TOTAL', '', totalGeneral, totalGeneral > 0 ? 1 : 0],
      ]
    } else if (tab === 'stock' && stockData) {
      filename = 'stock_valorizado.xlsx'
      sheetName = 'Stock valorizado'
      rows = [
        ['Producto', 'Categoria', 'Stock actual', 'Stock minimo', 'Precio costo', 'Precio venta', 'Valor costo', 'Valor venta', 'Bajo minimo'],
        ...stockData.productos.map(p => [
          p.nombre,
          p.categoria ?? '',
          p.stockActual,
          p.stockMinimo,
          p.precioCosto,
          p.precioVenta,
          p.valorCosto,
          p.valorVenta,
          p.bajoMinimo ? 'Si' : 'No',
        ]),
        ['TOTALES', '', '', '', '', '', stockData.totalValorCosto, stockData.totalValorVenta, ''],
      ]
    } else if (tab === 'cuenta_corriente' && ccData) {
      filename = `cuenta_corriente_${desde}_${hasta}.xlsx`
      sheetName = 'Cuenta corriente'
      rows = [
        ['Cliente', 'Saldo actual', 'Limite credito', 'Vendido periodo', 'Cobrado periodo', 'Ventas'],
        ...ccData.filas.map(f => [f.nombreCliente, f.saldoActual, f.limiteCredito, f.totalVendidoPeriodo, f.totalCobradoPeriodo, f.cantidadVentas]),
        [],
        ['RESUMEN', '', '', '', '', ''],
        ['Clientes con deuda', ccData.resumen.clientesConDeuda, '', '', '', ''],
        ['Total deuda', ccData.resumen.totalDeuda, '', '', '', ''],
        ['Total cobrado periodo', ccData.resumen.totalCobrado, '', '', '', ''],
      ]
    }

    if (!filename || rows.length === 0) return

    const sheet = XLSX.utils.aoa_to_sheet(rows)
    sheet['!cols'] = rows[0].map((_, col) => ({
      wch: Math.min(42, Math.max(12, ...rows.map(row => String(row[col] ?? '').length + 2))),
    }))
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName)
    XLSX.writeFile(workbook, filename)
  }, [tab, grupos, ranking, medios, stockData, resumen, desde, hasta])

  const TABS: { key: Tab; label: string }[] = [
    { key: 'ventas', label: 'Ventas' },
    { key: 'ranking', label: 'Ranking productos' },
    { key: 'medios_pago', label: 'Medios de pago' },
    { key: 'stock', label: 'Stock valorizado' },
    { key: 'cuenta_corriente', label: 'Cuenta corriente' },
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
              else if (tab === 'cuenta_corriente') cargarCC()
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

          {grupos.length > 0 && <VentasTrendChart grupos={grupos} />}

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
          {medios.length > 0 && <MediosPagoChart medios={medios} />}

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

      {tab === 'cuenta_corriente' && ccData && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Clientes con deuda" value={String(ccData.resumen.clientesConDeuda)} />
            <StatCard label="Deuda total" value={formatPrecio(ccData.resumen.totalDeuda)} />
            <StatCard label="Cobrado en período" value={formatPrecio(ccData.resumen.totalCobrado)} />
            <StatCard label="Ventas CC en período" value={formatPrecio(ccData.filas.reduce((s, f) => s + f.totalVendidoPeriodo, 0))} />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-slate-600 font-semibold">Cliente</th>
                  <th className="text-right px-4 py-3 text-slate-600 font-semibold">Saldo actual</th>
                  <th className="text-right px-4 py-3 text-slate-600 font-semibold">Límite</th>
                  <th className="text-right px-4 py-3 text-slate-600 font-semibold">Uso %</th>
                  <th className="text-right px-4 py-3 text-slate-600 font-semibold">Vendido período</th>
                  <th className="text-right px-4 py-3 text-slate-600 font-semibold">Cobrado período</th>
                  <th className="text-right px-4 py-3 text-slate-600 font-semibold">Ventas</th>
                </tr>
              </thead>
              <tbody>
                {ccData.filas.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-slate-400">Sin movimientos en cuenta corriente en el período</td></tr>
                )}
                {ccData.filas.map(f => {
                  const uso = f.limiteCredito > 0 ? (f.saldoActual / f.limiteCredito) * 100 : 0
                  const sobreLimite = uso >= 90
                  return (
                    <tr key={f.clienteId} className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 ${sobreLimite ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{f.nombreCliente}</p>
                        {sobreLimite && <p className="text-xs text-red-500 font-semibold">⚠ Cerca del límite</p>}
                      </td>
                      <td className={`px-4 py-3 text-right font-bold ${f.saldoActual > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatPrecio(f.saldoActual)}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{formatPrecio(f.limiteCredito)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-xs font-semibold ${sobreLimite ? 'text-red-600' : 'text-slate-500'}`}>{uso.toFixed(0)}%</span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">{formatPrecio(f.totalVendidoPeriodo)}</td>
                      <td className="px-4 py-3 text-right text-green-700">{formatPrecio(f.totalCobradoPeriodo)}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{f.cantidadVentas}</td>
                    </tr>
                  )
                })}
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

function VentasTrendChart({ grupos }: { grupos: GrupoVentasReporte[] }): JSX.Element {
  const width = 720
  const height = 220
  const padding = 28
  const maxTotal = Math.max(...grupos.map((g) => g.total), 1)
  const stepX = grupos.length > 1 ? (width - padding * 2) / (grupos.length - 1) : 0
  const points = grupos.map((g, idx) => {
    const x = grupos.length === 1 ? width / 2 : padding + idx * stepX
    const y = height - padding - (g.total / maxTotal) * (height - padding * 2)
    return { x, y, grupo: g }
  })
  const path = points.map((p) => `${p.x},${p.y}`).join(' ')

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-slate-700">Ventas por periodo</h2>
        <span className="text-xs text-slate-400">Max {formatPrecio(maxTotal)}</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-56">
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e2e8f0" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#e2e8f0" />
        <polyline fill="none" stroke="#2563eb" strokeWidth="3" points={path} />
        {points.map((p) => (
          <g key={p.grupo.periodo}>
            <circle cx={p.x} cy={p.y} r="4" fill="#2563eb" />
            <text x={p.x} y={height - 8} textAnchor="middle" className="fill-slate-500 text-[10px]">
              {p.grupo.periodo}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}

function MediosPagoChart({ medios }: { medios: MedioPagoReporte[] }): JSX.Element {
  const total = medios.reduce((sum, medio) => sum + medio.total, 0)
  const max = Math.max(...medios.map((medio) => medio.total), 1)

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-700">Cobros por medio de pago</h2>
        <span className="text-xs text-slate-400">Total {formatPrecio(total)}</span>
      </div>
      <div className="space-y-3">
        {medios.map((medio) => {
          const porcentaje = total > 0 ? (medio.total / total) * 100 : 0
          const ancho = `${Math.max(4, (medio.total / max) * 100)}%`
          return (
            <div key={medio.medioPago} className="grid grid-cols-[160px_1fr_110px] items-center gap-3 text-sm">
              <span className="font-medium text-slate-700 truncate">{LABELS_MEDIO_PAGO[medio.medioPago] ?? medio.medioPago}</span>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: ancho }} />
              </div>
              <span className="text-right text-slate-600">{porcentaje.toFixed(1)}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
