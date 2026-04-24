import { useEffect, useState, useCallback } from 'react'
import { useProductosStore } from '../stores/productos.store'
import { Table } from '../components/ui/Table'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { ProductoForm } from '../components/ProductoForm'
import { formatPrecio } from '../lib/format'
import type { Producto } from '../../../shared/types'

export function ProductosPage(): JSX.Element {
  const {
    productos, total, isLoading, search,
    fetchProductos, fetchCategorias, setSearch,
    deleteProducto,
  } = useProductosStore()

  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<Producto | null>(null)

  useEffect(() => {
    fetchProductos()
    fetchCategorias()
  }, [])

  const handleNuevo = useCallback(() => {
    setEditando(null)
    setModalOpen(true)
  }, [])

  const handleEditar = useCallback((p: Producto) => {
    setEditando(p)
    setModalOpen(true)
  }, [])

  const handleEliminar = useCallback(async (p: Producto) => {
    if (!confirm(`¿Desactivar "${p.nombre}"?`)) return
    await deleteProducto(p.id)
  }, [deleteProducto])

  const handleClose = useCallback(() => {
    setModalOpen(false)
    setEditando(null)
  }, [])

  const handleSaved = useCallback(() => {
    handleClose()
    fetchProductos()
  }, [handleClose, fetchProductos])

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Productos</h1>
          <p className="text-sm text-slate-500">{total} producto{total !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={handleNuevo}>+ Nuevo producto</Button>
      </div>

      {/* Search */}
      <Input
        placeholder="Buscar por nombre, código de barras o código interno... (F2)"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-lg"
      />

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <Table<Producto>
          keyExtractor={(p) => p.id}
          data={productos}
          onRowClick={handleEditar}
          emptyMessage={isLoading ? 'Cargando...' : 'No se encontraron productos'}
          columns={[
            {
              key: 'codigoBarras',
              header: 'Código',
              render: (p) => (
                <span className="font-mono text-xs text-slate-500">
                  {p.codigoBarras ?? p.codigoInterno ?? '—'}
                </span>
              ),
            },
            {
              key: 'nombre',
              header: 'Nombre',
              render: (p) => <span className="font-medium text-slate-800">{p.nombre}</span>,
            },
            {
              key: 'precioVenta',
              header: 'Precio venta',
              render: (p) => (
                <span className="font-semibold text-slate-800">{formatPrecio(p.precioVenta)}</span>
              ),
              headerClassName: 'text-right',
              className: 'text-right',
            },
            {
              key: 'precioCosto',
              header: 'Costo',
              render: (p) => (
                <span className="text-slate-500">{formatPrecio(p.precioCosto)}</span>
              ),
              headerClassName: 'text-right',
              className: 'text-right',
            },
            {
              key: 'stockActual',
              header: 'Stock',
              render: (p) => (
                <Badge variant={p.stockActual <= p.stockMinimo ? 'danger' : p.stockActual <= p.stockMinimo * 1.5 ? 'warning' : 'success'}>
                  {p.stockActual} {p.unidadMedida}
                </Badge>
              ),
            },
            {
              key: 'activo',
              header: 'Estado',
              render: (p) => (
                <Badge variant={p.activo ? 'success' : 'default'}>
                  {p.activo ? 'Activo' : 'Inactivo'}
                </Badge>
              ),
            },
            {
              key: 'acciones',
              header: '',
              render: (p) => (
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="ghost" onClick={() => handleEditar(p)}>
                    Editar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleEliminar(p)}>
                    ✕
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </div>

      <Modal
        open={modalOpen}
        onClose={handleClose}
        title={editando ? 'Editar producto' : 'Nuevo producto'}
        size="lg"
      >
        <ProductoForm
          producto={editando}
          onSaved={handleSaved}
          onCancel={handleClose}
        />
      </Modal>
    </div>
  )
}
