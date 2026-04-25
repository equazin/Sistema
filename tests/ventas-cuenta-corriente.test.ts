import { describe, expect, it } from 'vitest'
import {
  calcularMontoCuentaCorriente,
  validarCuentaCorrienteVenta,
} from '../src/main/ipc/ventas'
import type { PagoVenta } from '../src/shared/types'

describe('cuenta corriente en ventas', () => {
  it('calcula solo el monto cobrado por cuenta corriente', () => {
    const pagos: PagoVenta[] = [
      { medioPago: 'efectivo', monto: 100, referencia: null },
      { medioPago: 'cuenta_corriente', monto: 250, referencia: null },
      { medioPago: 'debito', monto: 50, referencia: null },
    ]

    expect(calcularMontoCuentaCorriente(pagos)).toBe(250)
  })

  it('permite la venta si el saldo nuevo queda dentro del limite', () => {
    expect(() => validarCuentaCorrienteVenta({
      clienteId: 1,
      cliente: {
        id: 1,
        nombre: 'Cliente Cuenta',
        saldo_cuenta_corriente: 100,
        limite_credito: 500,
        activo: 1,
      },
      montoCuentaCorriente: 250,
    })).not.toThrow()
  })

  it('rechaza cuenta corriente sin cliente', () => {
    expect(() => validarCuentaCorrienteVenta({
      clienteId: null,
      cliente: undefined,
      montoCuentaCorriente: 250,
    })).toThrow('Seleccioná un cliente')
  })

  it('rechaza cliente inactivo o inexistente', () => {
    expect(() => validarCuentaCorrienteVenta({
      clienteId: 1,
      cliente: {
        id: 1,
        nombre: 'Cliente Cuenta',
        saldo_cuenta_corriente: 100,
        limite_credito: 500,
        activo: 0,
      },
      montoCuentaCorriente: 250,
    })).toThrow('Cliente no válido')
  })

  it('rechaza la venta si supera el limite de credito', () => {
    expect(() => validarCuentaCorrienteVenta({
      clienteId: 1,
      cliente: {
        id: 1,
        nombre: 'Cliente Cuenta',
        saldo_cuenta_corriente: 100,
        limite_credito: 300,
        activo: 1,
      },
      montoCuentaCorriente: 250,
    })).toThrow('límite de crédito')
  })
})
