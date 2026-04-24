import { useState, useEffect, useCallback } from 'react'
import { invoke } from '../lib/api'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Badge } from '../components/ui/Badge'
import { formatPrecio, formatFecha } from '../lib/format'
import { useAuthStore } from '../stores/auth.store'
import { useProductosStore } from '../stores/productos.store'
import type { Proveedor, OrdenCompra, ItemOrdenCompra } from '../../../shared/types'

type Tab = 'proveedores' | 'compras'
type ModalMode = 'crear_prov' | 'editar_prov' | 'nueva_oc' | 'detalle_oc' | null

export function ProveedoresPage(): JSX.Element {
  const { usuario } = useAuthStore()
  const { productos, fetchProductos } = useProductosStore()

  const [tab, setTab] = useState<Tab>('proveedores')
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [compras, setCompras] = useState<OrdenCompra[]>([])
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [provSeleccionado, setProvSeleccionado] = useState<Proveedor | null>(null)
  const [detalleOC, setDetalleOC] = useState<(OrdenCompra & { items: ItemOrdenCompra[] }) | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Form proveedor
  const [formProv, setFormProv] = useState({ nombre: '', cuit: '', telefono: '', email: '', condicionPago: '' })

  // Nueva OC
  const [provOCId, setProvOCId] = useState<number | null>(null)
  const [itemsOC, setItemsOC] = useState<{ productoId: number; nombre: string; cantidad: string; precioUnitario: string }[]>([])

  const cargarProveedores = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await invoke('proveedores:list', {})
      setProveedores(res)
    } finally { setIsLoading(false) }
  }, [])

  const cargarCompras = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await invoke('compras:list', {})
      setCompras(res)
    } finally { setIsLoading(false) }
  }, [])

  useEffect(() => {
    cargarProveedores()
    fetchProductos()
  }, [])

  useEffect(() => {
    if (tab === 'compras') cargarCompras()
  }, [tab])

  const abrirCrearProv = useCallback(() => {
    setFormProv({ nombre: '', cuit: '', telefono: '', email: '', condicionPago: '' })
    setProvSeleccionado(null)
    setModalMode('crear_prov')
  }, [])

  const abrirEditarProv = useCallback((p: Proveedor) => {
    setFormProv({ nombre: p.nombre, cuit: p.cuit ?? '', telefono: p.telefono ?? '', email: p.email ?? '', condicionPago: p.condicionPago ?? '' })
    setProvSeleccionado(p)
    setModalMode('editar_prov')
  }, [])

  const handleGuardarProv = useCallback(async () => {
    if (!formProv.nombre.trim()) return alert('El nombre es obligatorio')
    try {
      const base = {
        negocioId: usuario?.negocioId ?? 1,
        nombre: formProv.nombre.trim(),
        cuit: formProv.cuit.trim() || null,
        telefono: formProv.telefono.trim() || null,
        email: formProv.email.trim() || null,
        condicionPago: formProv.condicionPago.trim() || null,
      }
      if (modalMode === 'crear_prov') {
        await invoke('proveedores:create', base)
      } else if (provSeleccionado) {
        await invoke('proveedores:update', { id: provSeleccionado.id, ...base })
      }
      setModalMode(null)
      cargarProveedores()
    } catch (err) { alert(err instanceof Error ? err.message : 'Error') }
  }, [formProv, modalMode, provSeleccionado, usuario, cargarProveedores])

  const handleEliminarProv = useCallback(async (p: Proveedor) => {
    if (!confirm(`¿Eliminar a ${p.nombre}?`)) return
    try {
      await invoke('proveedores:delete', { id: p.id })
      cargarProveedores()
    } catch (err) { alert(err instanceof Error ? err.message : 'Error') }
  }, [cargarProveedores])

  // OC
  const abrirNuevaOC = useCallback(() => {
    setProvOCId(null)
    setItemsOC([])
    setModalMode('nueva_oc')
  }, [])

  const agregarItemOC = useCallback(() => {
    setItemsOC(prev => [...prev, { productoId: 0, nombre: '', cantidad: '1', precioUnitario: '0' }])
  }, [])

  const actualizarItemOC = useCallback((idx: number, field: string, value: string | number) => {
    setItemsOC(prev => prev.map((item, i) => {
      if (i !== idx) return item
      if (field === 'productoId') {
        const prod = productos.find(p => p.id === Number(value))
        return { ...item, productoId: Number(value), nombre: prod?.nombre ?? '', precioUnitario: String(prod?.precioCosto ?? 0) }
      }
      return { ...item, [field]: String(value) }
    }))
  }, [productos])

  const handleCrearOC = useCallback(async () => {
    if (!provOCId) return alert('Seleccioná un proveedor')
    if (itemsOC.length === 0) return alert('Agregá al menos un producto')
    if (!usuario) return
    try {
      const items = itemsOC
        .filter(i => i.productoId > 0 && Number(i.cantidad) > 0)
        .map(i => ({
          productoId: i.productoId,
          cantidad: Number(i.cantidad),
          precioUnitario: Number(i.precioUnitario),
          subtotal: Number(i.cantidad) * Number(i.precioUnitario),
        }))
      if (items.length === 0) return alert('Completá los items correctamente')
      await invoke('compras:crear', { proveedorId: provOCId, usuarioId: usuario.id, items })
      setModalMode(null)
      setTab('compras')
      cargarCompras()
    } catch (err) { alert(err instanceof Error ? err.message : 'Error') }
  }, [provOCId, itemsOC, usuario, cargarCompras])

  const abrirDetalleOC = useCallback(async (oc: OrdenCompra) => {
    try {
      const res = await invoke('compras:get', { id: oc.id })
      setDetalleOC(res)
      setModalMode('detalle_oc')
    } catch (err) { alert(err instanceof Error ? err.message : 'Error') }
  }, [])

  const handleRecibirOC = useCallback(async () => {
    if (!detalleOC || !usuario) return
    if (!confirm('¿Confirmar recepción de mercadería? Esto incrementará el stock.')) return
    try {
      await invoke('compras:recibir', { compraId: detalleOC.id, usuarioId: usuario.id })
      setModalMode(null)
      cargarCompras()
    } catch (err) { alert(err instanceof Error ? err.message : 'Error') }
  }, [detalleOC, usuario, cargarCompras])

  const totalOC = itemsOC.reduce((s, i) => s + Number(i.cantidad) * Number(i.precioUnitario), 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Proveedores y Compras</h1>
        <div className="flex gap-2">
          {tab === 'proveedores' && <Button onClick={abrirCrearProv}>+ Nuevo proveedor</Button>}
          {tab === 'compras' && <Button onClick={abrirNuevaOC}>+ Nueva orden de compra</Button>}
        </div>
      </div>

      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {(['proveedores', 'compras'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
              tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'compras' ? 'Órdenes de compra' : 'Proveedores'}
          </button>
        ))}
      </div>

      {tab === 'proveedores' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-slate-600 font-semibold">Nombre</th>
                <th className="text-left px-4 py-3 text-slate-600 font-semibold">CUIT</th>
                <th className="text-left px-4 py-3 text-slate-600 font-semibold">Teléfono</th>
                <th className="text-left px-4 py-3 text-slate-600 font-semibold">Condición pago</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={5} className="text-center py-8 text-slate-400">Cargando...</td></tr>}
              {!isLoading && proveedores.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-slate-400">Sin proveedores registrados</td></tr>}
              {proveedores.map(p => (
                <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{p.nombre}</td>
                  <td className="px-4 py-3 text-slate-500">{p.cuit ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{p.telefono ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{p.condicionPago ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="outline" onClick={() => abrirEditarProv(p)}>Editar</Button>
                      <Button size="sm" variant="destructive" onClick={() => handleEliminarProv(p)}>Eliminar</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'compras' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-slate-600 font-semibold">#</th>
                <th className="text-left px-4 py-3 text-slate-600 font-semibold">Proveedor</th>
                <th className="text-left px-4 py-3 text-slate-600 font-semibold">Fecha</th>
                <th className="text-left px-4 py-3 text-slate-600 font-semibold">Estado</th>
                <th className="text-right px-4 py-3 text-slate-600 font-semibold">Total</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className="text-center py-8 text-slate-400">Cargando...</td></tr>}
              {!isLoading && compras.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate-400">Sin órdenes de compra</td></tr>}
              {compras.map(oc => (
                <tr key={oc.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500">#{oc.id}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{oc.nombreProveedor}</td>
                  <td className="px-4 py-3 text-slate-500">{formatFecha(oc.fecha)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={oc.estado === 'recibida' ? 'success' : oc.estado === 'cancelada' ? 'danger' : 'warning'}>
                      {oc.estado}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{formatPrecio(oc.total)}</td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="outline" onClick={() => abrirDetalleOC(oc)}>Ver detalle</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal proveedor */}
      <Modal
        isOpen={modalMode === 'crear_prov' || modalMode === 'editar_prov'}
        onClose={() => setModalMode(null)}
        title={modalMode === 'crear_prov' ? 'Nuevo proveedor' : 'Editar proveedor'}
        size="md"
      >
        <div className="flex flex-col gap-4">
          <Input label="Nombre *" value={formProv.nombre} onChange={e => setFormProv(f => ({ ...f, nombre: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="CUIT" value={formProv.cuit} onChange={e => setFormProv(f => ({ ...f, cuit: e.target.value }))} />
            <Input label="Teléfono" value={formProv.telefono} onChange={e => setFormProv(f => ({ ...f, telefono: e.target.value }))} />
          </div>
          <Input label="Email" value={formProv.email} onChange={e => setFormProv(f => ({ ...f, email: e.target.value }))} />
          <Input label="Condición de pago" value={formProv.condicionPago} onChange={e => setFormProv(f => ({ ...f, condicionPago: e.target.value }))} />
          <div className="flex gap-3 justify-end mt-2">
            <Button variant="outline" onClick={() => setModalMode(null)}>Cancelar</Button>
            <Button onClick={handleGuardarProv}>Guardar</Button>
          </div>
        </div>
      </Modal>

      {/* Modal nueva OC */}
      <Modal
        isOpen={modalMode === 'nueva_oc'}
        onClose={() => setModalMode(null)}
        title="Nueva orden de compra"
        size="xl"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Proveedor *</label>
            <select
              value={provOCId ?? ''}
              onChange={e => setProvOCId(Number(e.target.value) || null)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">— Seleccionar proveedor —</option>
              {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-slate-700">Items</p>
              <Button size="sm" variant="outline" onClick={agregarItemOC}>+ Agregar producto</Button>
            </div>
            {itemsOC.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">Sin items. Agregá productos a la orden.</p>
            )}
            {itemsOC.map((item, idx) => (
              <div key={idx} className="grid grid-cols-4 gap-2 mb-2 items-end">
                <div className="col-span-2 flex flex-col gap-1">
                  <label className="text-xs text-slate-500">Producto</label>
                  <select
                    value={item.productoId || ''}
                    onChange={e => actualizarItemOC(idx, 'productoId', e.target.value)}
                    className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
                  >
                    <option value="">— Producto —</option>
                    {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-500">Cantidad</label>
                  <input
                    type="number"
                    min={1}
                    value={item.cantidad}
                    onChange={e => actualizarItemOC(idx, 'cantidad', e.target.value)}
                    className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-500">Precio costo</label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      min={0}
                      value={item.precioUnitario}
                      onChange={e => actualizarItemOC(idx, 'precioUnitario', e.target.value)}
                      className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm flex-1"
                    />
                    <button
                      onClick={() => setItemsOC(prev => prev.filter((_, i) => i !== idx))}
                      className="text-red-400 hover:text-red-600 text-lg leading-none"
                    >×</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {itemsOC.length > 0 && (
            <div className="flex justify-between text-sm font-semibold bg-slate-50 rounded-lg p-3">
              <span className="text-slate-600">Total orden</span>
              <span className="text-slate-800">{formatPrecio(totalOC)}</span>
            </div>
          )}

          <div className="flex gap-3 justify-end mt-2">
            <Button variant="outline" onClick={() => setModalMode(null)}>Cancelar</Button>
            <Button onClick={handleCrearOC}>Crear orden</Button>
          </div>
        </div>
      </Modal>

      {/* Modal detalle OC */}
      <Modal
        isOpen={modalMode === 'detalle_oc'}
        onClose={() => setModalMode(null)}
        title={`Orden de compra #${detalleOC?.id}`}
        size="lg"
      >
        {detalleOC && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Proveedor</p>
                <p className="font-semibold text-slate-800">{detalleOC.nombreProveedor}</p>
              </div>
              <Badge variant={detalleOC.estado === 'recibida' ? 'success' : detalleOC.estado === 'cancelada' ? 'danger' : 'warning'}>
                {detalleOC.estado}
              </Badge>
            </div>

            <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-3 py-2 text-slate-600">Producto</th>
                  <th className="text-right px-3 py-2 text-slate-600">Cantidad</th>
                  <th className="text-right px-3 py-2 text-slate-600">Precio</th>
                  <th className="text-right px-3 py-2 text-slate-600">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {detalleOC.items.map((item, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-800">{item.nombreProducto}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{item.cantidad}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{formatPrecio(item.precioUnitario)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{formatPrecio(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-200 bg-slate-50">
                <tr>
                  <td colSpan={3} className="px-3 py-2 font-semibold text-slate-700">Total</td>
                  <td className="px-3 py-2 text-right font-bold text-slate-800">{formatPrecio(detalleOC.total)}</td>
                </tr>
              </tfoot>
            </table>

            {detalleOC.estado === 'pendiente' && (
              <Button variant="success" onClick={handleRecibirOC} className="w-full">
                Confirmar recepción de mercadería
              </Button>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
