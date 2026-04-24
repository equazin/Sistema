import { useState, useCallback } from 'react'
import { useProductosStore } from '../stores/productos.store'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import type { Producto, UnidadMedida } from '../../../shared/types'

interface ProductoFormProps {
  producto: Producto | null
  onSaved: () => void
  onCancel: () => void
}

type FormData = {
  nombre: string
  codigoBarras: string
  codigoInterno: string
  unidadMedida: UnidadMedida
  precioCosto: string
  precioVenta: string
  precioMayorista: string
  stockActual: string
  stockMinimo: string
  pesable: boolean
}

function toForm(p: Producto | null): FormData {
  return {
    nombre: p?.nombre ?? '',
    codigoBarras: p?.codigoBarras ?? '',
    codigoInterno: p?.codigoInterno ?? '',
    unidadMedida: p?.unidadMedida ?? 'unidad',
    precioCosto: String(p?.precioCosto ?? ''),
    precioVenta: String(p?.precioVenta ?? ''),
    precioMayorista: String(p?.precioMayorista ?? ''),
    stockActual: String(p?.stockActual ?? '0'),
    stockMinimo: String(p?.stockMinimo ?? '0'),
    pesable: p?.pesable ?? false,
  }
}

export function ProductoForm({ producto, onSaved, onCancel }: ProductoFormProps): JSX.Element {
  const { createProducto, updateProducto } = useProductosStore()
  const [form, setForm] = useState<FormData>(toForm(producto))
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const set = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }, [])

  const validate = (): boolean => {
    const errs: Partial<Record<keyof FormData, string>> = {}
    if (!form.nombre.trim()) errs.nombre = 'Requerido'
    if (!form.precioVenta || isNaN(Number(form.precioVenta))) errs.precioVenta = 'Precio inválido'
    if (Number(form.precioVenta) < 0) errs.precioVenta = 'Debe ser >= 0'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = useCallback(async () => {
    if (!validate()) return
    setIsSubmitting(true)
    try {
      const data = {
        negocioId: 1,
        nombre: form.nombre.trim(),
        codigoBarras: form.codigoBarras.trim() || null,
        codigoInterno: form.codigoInterno.trim() || null,
        unidadMedida: form.unidadMedida,
        precioCosto: Number(form.precioCosto) || 0,
        precioVenta: Number(form.precioVenta) || 0,
        precioMayorista: form.precioMayorista ? Number(form.precioMayorista) : null,
        stockActual: Number(form.stockActual) || 0,
        stockMinimo: Number(form.stockMinimo) || 0,
        stockMaximo: null,
        categoriaId: null,
        descripcion: null,
        pesable: form.pesable,
        activo: true,
      }
      if (producto) {
        await updateProducto(producto.id, data)
      } else {
        await createProducto(data)
      }
      onSaved()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setIsSubmitting(false)
    }
  }, [form, producto, createProducto, updateProducto, onSaved])

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Nombre *"
          value={form.nombre}
          onChange={(e) => set('nombre', e.target.value)}
          error={errors.nombre}
          autoFocus
          placeholder="Ej: Coca Cola 500ml"
        />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">Unidad de medida</label>
          <select
            value={form.unidadMedida}
            onChange={(e) => set('unidadMedida', e.target.value as UnidadMedida)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
          >
            <option value="unidad">Unidad</option>
            <option value="kg">Kilogramo</option>
            <option value="gr">Gramo</option>
            <option value="lt">Litro</option>
            <option value="ml">Mililitro</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Código de barras"
          value={form.codigoBarras}
          onChange={(e) => set('codigoBarras', e.target.value)}
          placeholder="EAN-13 / UPC"
        />
        <Input
          label="Código interno"
          value={form.codigoInterno}
          onChange={(e) => set('codigoInterno', e.target.value)}
          placeholder="Código propio"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Input
          label="Precio venta $ *"
          value={form.precioVenta}
          onChange={(e) => set('precioVenta', e.target.value)}
          error={errors.precioVenta}
          inputMode="decimal"
          placeholder="0,00"
        />
        <Input
          label="Precio costo $"
          value={form.precioCosto}
          onChange={(e) => set('precioCosto', e.target.value)}
          inputMode="decimal"
          placeholder="0,00"
        />
        <Input
          label="Precio mayorista $"
          value={form.precioMayorista}
          onChange={(e) => set('precioMayorista', e.target.value)}
          inputMode="decimal"
          placeholder="0,00"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Stock actual"
          value={form.stockActual}
          onChange={(e) => set('stockActual', e.target.value)}
          inputMode="decimal"
          placeholder="0"
        />
        <Input
          label="Stock mínimo (alerta)"
          value={form.stockMinimo}
          onChange={(e) => set('stockMinimo', e.target.value)}
          inputMode="decimal"
          placeholder="0"
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={form.pesable}
          onChange={(e) => set('pesable', e.target.checked)}
          className="w-4 h-4 rounded"
        />
        <span className="text-sm text-slate-700">Producto pesable (requiere balanza)</span>
      </label>

      <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
        <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : producto ? 'Guardar cambios' : 'Crear producto'}
        </Button>
      </div>
    </div>
  )
}
