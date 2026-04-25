import { useState, useEffect, useCallback } from 'react'
import { invoke } from '../lib/api'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Badge } from '../components/ui/Badge'
import { formatPrecio, formatFecha } from '../lib/format'
import { useAuthStore } from '../stores/auth.store'
import type { Cliente } from '../../../shared/types'

type ModalMode = 'crear' | 'editar' | 'cuenta' | null

const CONDICION_AFIP_LABELS: Record<string, string> = {
  monotributo: 'Monotributo',
  responsable_inscripto: 'Resp. Inscripto',
  exento: 'Exento',
  consumidor_final: 'Consumidor Final',
}

export function ClientesPage(): JSX.Element {
  const { usuario } = useAuthStore()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null)

  // Form state
  const [form, setForm] = useState({
    nombre: '',
    cuitDni: '',
    telefono: '',
    email: '',
    condicionAfip: 'consumidor_final' as Cliente['condicionAfip'],
    limiteCredito: '0',
  })

  // Cuenta corriente
  const [cuentaData, setCuentaData] = useState<{
    ventas: { id: number; fecha: string; total: number; estado: string }[]
    cobranzas: { id: number; fecha: string; monto: number; medioPago: string; observacion: string | null }[]
    saldoActual: number
  } | null>(null)
  const [montoCobranza, setMontoCobranza] = useState('')
  const [medioPagoCobranza, setMedioPagoCobranza] = useState('efectivo')
  const [obsCobranza, setObsCobranza] = useState('')

  const cargar = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await invoke('clientes:list', { search: search || undefined })
      setClientes(res)
    } finally {
      setIsLoading(false)
    }
  }, [search])

  useEffect(() => { cargar() }, [])

  const handleBuscar = useCallback(() => { cargar() }, [cargar])

  const abrirCrear = useCallback(() => {
    setForm({ nombre: '', cuitDni: '', telefono: '', email: '', condicionAfip: 'consumidor_final', limiteCredito: '0' })
    setClienteSeleccionado(null)
    setModalMode('crear')
  }, [])

  const abrirEditar = useCallback((c: Cliente) => {
    setForm({
      nombre: c.nombre,
      cuitDni: c.cuitDni ?? '',
      telefono: c.telefono ?? '',
      email: c.email ?? '',
      condicionAfip: c.condicionAfip,
      limiteCredito: String(c.limiteCredito),
    })
    setClienteSeleccionado(c)
    setModalMode('editar')
  }, [])

  const abrirCuenta = useCallback(async (c: Cliente) => {
    setClienteSeleccionado(c)
    setModalMode('cuenta')
    setMontoCobranza('')
    setObsCobranza('')
    try {
      const res = await invoke('clientes:estadoCuenta', { clienteId: c.id })
      setCuentaData(res)
    } catch {
      setCuentaData(null)
    }
  }, [])

  const handleGuardar = useCallback(async () => {
    if (!form.nombre.trim()) return alert('El nombre es obligatorio')
    try {
      const base = {
        negocioId: usuario?.negocioId ?? 1,
        nombre: form.nombre.trim(),
        cuitDni: form.cuitDni.trim() || null,
        telefono: form.telefono.trim() || null,
        email: form.email.trim() || null,
        condicionAfip: form.condicionAfip,
        limiteCredito: Number(form.limiteCredito) || 0,
      }
      if (modalMode === 'crear') {
        await invoke('clientes:create', { ...base, usuarioId: usuario?.id })
      } else if (clienteSeleccionado) {
        await invoke('clientes:update', { id: clienteSeleccionado.id, ...base, usuarioId: usuario?.id })
      }
      setModalMode(null)
      cargar()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al guardar')
    }
  }, [form, modalMode, clienteSeleccionado, usuario, cargar])

  const handleEliminar = useCallback(async (c: Cliente) => {
    if (!confirm(`¿Eliminar a ${c.nombre}?`)) return
    try {
      await invoke('clientes:delete', { id: c.id, usuarioId: usuario?.id })
      cargar()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar')
    }
  }, [cargar, usuario])

  const handleRegistrarCobranza = useCallback(async () => {
    if (!clienteSeleccionado || !usuario) return
    const monto = Number(montoCobranza)
    if (!monto || monto <= 0) return alert('Ingresá un monto válido')
    try {
      await invoke('clientes:registrarCobranza', {
        clienteId: clienteSeleccionado.id,
        monto,
        medioPago: medioPagoCobranza,
        observacion: obsCobranza || undefined,
        usuarioId: usuario.id,
      })
      await abrirCuenta(clienteSeleccionado)
      setMontoCobranza('')
      setObsCobranza('')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al registrar cobranza')
    }
  }, [clienteSeleccionado, usuario, montoCobranza, medioPagoCobranza, obsCobranza, abrirCuenta])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Clientes</h1>
        <Button onClick={abrirCrear}>+ Nuevo cliente</Button>
      </div>

      <div className="flex gap-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleBuscar()}
          placeholder="Buscar por nombre, CUIT/DNI, teléfono..."
          className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400"
        />
        <Button variant="outline" onClick={handleBuscar} disabled={isLoading}>Buscar</Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 text-slate-600 font-semibold">Nombre</th>
              <th className="text-left px-4 py-3 text-slate-600 font-semibold">CUIT/DNI</th>
              <th className="text-left px-4 py-3 text-slate-600 font-semibold">Teléfono</th>
              <th className="text-left px-4 py-3 text-slate-600 font-semibold">Condición</th>
              <th className="text-right px-4 py-3 text-slate-600 font-semibold">Saldo CC</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="text-center py-8 text-slate-400">Cargando...</td></tr>
            )}
            {!isLoading && clientes.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-slate-400">Sin clientes registrados</td></tr>
            )}
            {clientes.map(c => (
              <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{c.nombre}</td>
                <td className="px-4 py-3 text-slate-500">{c.cuitDni ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500">{c.telefono ?? '—'}</td>
                <td className="px-4 py-3">
                  <Badge variant="info">{CONDICION_AFIP_LABELS[c.condicionAfip] ?? c.condicionAfip}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={c.saldoCuentaCorriente > 0 ? 'text-red-600 font-bold' : 'text-slate-600'}>
                    {formatPrecio(c.saldoCuentaCorriente)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="outline" onClick={() => abrirCuenta(c)}>Cuenta</Button>
                    <Button size="sm" variant="outline" onClick={() => abrirEditar(c)}>Editar</Button>
                    <Button size="sm" variant="destructive" onClick={() => handleEliminar(c)}>Eliminar</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal crear/editar */}
      <Modal
        isOpen={modalMode === 'crear' || modalMode === 'editar'}
        onClose={() => setModalMode(null)}
        title={modalMode === 'crear' ? 'Nuevo cliente' : 'Editar cliente'}
        size="md"
      >
        <div className="flex flex-col gap-4">
          <Input label="Nombre *" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
          <Input label="CUIT / DNI" value={form.cuitDni} onChange={e => setForm(f => ({ ...f, cuitDni: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Teléfono" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
            <Input label="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Condición AFIP</label>
            <select
              value={form.condicionAfip}
              onChange={e => setForm(f => ({ ...f, condicionAfip: e.target.value as Cliente['condicionAfip'] }))}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            >
              {Object.entries(CONDICION_AFIP_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <Input label="Límite de crédito $" value={form.limiteCredito} onChange={e => setForm(f => ({ ...f, limiteCredito: e.target.value }))} inputMode="numeric" />
          <div className="flex gap-3 justify-end mt-2">
            <Button variant="outline" onClick={() => setModalMode(null)}>Cancelar</Button>
            <Button onClick={handleGuardar}>Guardar</Button>
          </div>
        </div>
      </Modal>

      {/* Modal cuenta corriente */}
      <Modal
        isOpen={modalMode === 'cuenta'}
        onClose={() => setModalMode(null)}
        title={`Cuenta corriente — ${clienteSeleccionado?.nombre}`}
        size="lg"
      >
        {cuentaData ? (
          <div className="flex flex-col gap-4">
            <div className={`text-center p-4 rounded-xl ${cuentaData.saldoActual > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
              <p className="text-sm text-slate-500">Saldo actual</p>
              <p className={`text-3xl font-bold ${cuentaData.saldoActual > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatPrecio(cuentaData.saldoActual)}
              </p>
              {cuentaData.saldoActual > 0 && <p className="text-xs text-red-400 mt-1">El cliente tiene deuda pendiente</p>}
            </div>

            {cuentaData.saldoActual > 0 && (
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-sm font-semibold text-slate-700 mb-3">Registrar cobranza</p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <Input label="Monto $" value={montoCobranza} onChange={e => setMontoCobranza(e.target.value)} inputMode="numeric" />
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-slate-700">Medio de pago</label>
                    <select value={medioPagoCobranza} onChange={e => setMedioPagoCobranza(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
                      <option value="efectivo">Efectivo</option>
                      <option value="transferencia">Transferencia</option>
                      <option value="debito">Débito</option>
                      <option value="cheque">Cheque</option>
                    </select>
                  </div>
                </div>
                <Input label="Observación" value={obsCobranza} onChange={e => setObsCobranza(e.target.value)} />
                <Button className="mt-3 w-full" variant="success" onClick={handleRegistrarCobranza}>Registrar cobranza</Button>
              </div>
            )}

            <details open>
              <summary className="text-sm font-semibold text-slate-700 cursor-pointer mb-2">Ventas en cuenta ({cuentaData.ventas.length})</summary>
              {cuentaData.ventas.length === 0 ? (
                <p className="text-sm text-slate-400">Sin ventas en cuenta corriente</p>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50"><tr>
                      <th className="text-left px-3 py-2 text-slate-500">#</th>
                      <th className="text-left px-3 py-2 text-slate-500">Fecha</th>
                      <th className="text-right px-3 py-2 text-slate-500">Total</th>
                    </tr></thead>
                    <tbody>
                      {cuentaData.ventas.map(v => (
                        <tr key={v.id} className="border-t border-slate-100">
                          <td className="px-3 py-2 text-slate-400">#{v.id}</td>
                          <td className="px-3 py-2 text-slate-600">{formatFecha(v.fecha)}</td>
                          <td className="px-3 py-2 text-right font-semibold">{formatPrecio(v.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </details>

            {cuentaData.cobranzas.length > 0 && (
              <details>
                <summary className="text-sm font-semibold text-slate-700 cursor-pointer mb-2">Cobranzas ({cuentaData.cobranzas.length})</summary>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50"><tr>
                      <th className="text-left px-3 py-2 text-slate-500">Fecha</th>
                      <th className="text-left px-3 py-2 text-slate-500">Medio</th>
                      <th className="text-right px-3 py-2 text-slate-500">Monto</th>
                    </tr></thead>
                    <tbody>
                      {cuentaData.cobranzas.map(c => (
                        <tr key={c.id} className="border-t border-slate-100">
                          <td className="px-3 py-2 text-slate-600">{formatFecha(c.fecha)}</td>
                          <td className="px-3 py-2 text-slate-500 capitalize">{c.medioPago}</td>
                          <td className="px-3 py-2 text-right font-semibold text-green-600">− {formatPrecio(c.monto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </div>
        ) : (
          <p className="text-slate-400 text-center py-8">Cargando...</p>
        )}
      </Modal>
    </div>
  )
}
