import { useEffect, useState, useCallback } from 'react'
import { useCajaStore } from '../stores/caja.store'
import { useAuthStore } from '../stores/auth.store'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { formatPrecio, formatFecha } from '../lib/format'

const CAJA_ID = 1

export function CajaPage(): JSX.Element {
  const { usuario } = useAuthStore()
  const { turnoActual, ventasDelTurno, isLoading, fetchTurno, abrirTurno, cerrarTurno, fetchVentasDelTurno } = useCajaStore()
  const [montoApertura, setMontoApertura] = useState('0')
  const [montoCierre, setMontoCierre] = useState('0')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [turnoRecienCerrado, setTurnoRecienCerrado] = useState<import('../../../shared/types').TurnoCaja | null>(null)

  useEffect(() => {
    fetchTurno(CAJA_ID)
  }, [])

  useEffect(() => {
    if (turnoActual) fetchVentasDelTurno()
  }, [turnoActual])

  const handleAbrir = useCallback(async () => {
    if (!usuario) return
    setIsSubmitting(true)
    try {
      await abrirTurno(CAJA_ID, usuario.id, Number(montoApertura) || 0)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al abrir caja')
    } finally {
      setIsSubmitting(false)
    }
  }, [usuario, montoApertura, abrirTurno])

  const handleCerrar = useCallback(async () => {
    if (!turnoActual) return
    if (!confirm('¿Cerrar el turno de caja?')) return
    setIsSubmitting(true)
    try {
      const cerrado = await cerrarTurno(turnoActual.id, Number(montoCierre) || 0)
      setTurnoRecienCerrado(cerrado)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al cerrar caja')
    } finally {
      setIsSubmitting(false)
    }
  }, [turnoActual, montoCierre, cerrarTurno])

  const totalVentas = ventasDelTurno.reduce((sum, v) => sum + v.total, 0)
  const cantidadVentas = ventasDelTurno.length

  if (turnoRecienCerrado) {
    const dif = turnoRecienCerrado.diferencia ?? 0
    return (
      <div className="max-w-lg mx-auto mt-12">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-slate-800 mb-6">Caja cerrada</h2>
          <div className="space-y-3 text-left bg-slate-50 rounded-xl p-4">
            <Row label="Apertura" value={formatPrecio(turnoRecienCerrado.montoApertura)} />
            <Row label="Total sistema (efectivo)" value={formatPrecio(turnoRecienCerrado.montoCierre_sistema ?? 0)} />
            <Row label="Declarado" value={formatPrecio(turnoRecienCerrado.montoCierreDeclado ?? 0)} />
            <Row
              label="Diferencia"
              value={formatPrecio(Math.abs(dif))}
              valueClass={dif === 0 ? 'text-green-600' : dif > 0 ? 'text-blue-600' : 'text-red-500'}
            />
          </div>
          <Button className="mt-6 w-full" onClick={() => setTurnoRecienCerrado(null)}>
            Cerrar
          </Button>
        </div>
      </div>
    )
  }

  if (!turnoActual) {
    return (
      <div className="max-w-md mx-auto mt-12">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <h2 className="text-xl font-bold text-slate-800 mb-2">Abrir turno de caja</h2>
          <p className="text-slate-500 text-sm mb-6">Ingresá el monto de apertura en efectivo</p>
          <Input
            label="Monto de apertura $"
            value={montoApertura}
            onChange={(e) => setMontoApertura(e.target.value)}
            inputMode="numeric"
            className="text-2xl font-bold text-center mb-4"
          />
          <Button
            onClick={handleAbrir}
            disabled={isSubmitting || isLoading}
            className="w-full"
            size="lg"
          >
            {isSubmitting ? 'Abriendo...' : 'Abrir caja'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Caja abierta</h1>
          <p className="text-sm text-slate-500">Turno desde {formatFecha(turnoActual.aperturaAt)}</p>
        </div>
        <Button variant="destructive" onClick={handleCerrar} disabled={isSubmitting}>
          Cerrar caja
        </Button>
      </div>

      {/* Resumen del turno */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Ventas del turno" value={String(cantidadVentas)} />
        <StatCard label="Total recaudado" value={formatPrecio(totalVentas)} />
        <StatCard label="Apertura en efectivo" value={formatPrecio(turnoActual.montoApertura)} />
      </div>

      {/* Monto cierre */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 max-w-sm">
        <Input
          label="Efectivo en caja al cerrar $"
          value={montoCierre}
          onChange={(e) => setMontoCierre(e.target.value)}
          inputMode="numeric"
          placeholder="0"
        />
      </div>

      {/* Ventas del turno */}
      {ventasDelTurno.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-700 mb-3">Ventas del turno</h2>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-slate-600 font-semibold">#</th>
                  <th className="text-left px-4 py-3 text-slate-600 font-semibold">Hora</th>
                  <th className="text-left px-4 py-3 text-slate-600 font-semibold">Estado</th>
                  <th className="text-right px-4 py-3 text-slate-600 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {ventasDelTurno.map((v) => (
                  <tr key={v.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 text-slate-500">#{v.id}</td>
                    <td className="px-4 py-3 text-slate-600">{formatFecha(v.fecha)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        v.estado === 'completada' ? 'bg-green-100 text-green-700' :
                        v.estado === 'anulada' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {v.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{formatPrecio(v.total)}</td>
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

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }): JSX.Element {
  return (
    <div className="flex justify-between">
      <span className="text-slate-600">{label}</span>
      <span className={`font-semibold ${valueClass ?? 'text-slate-800'}`}>{value}</span>
    </div>
  )
}
