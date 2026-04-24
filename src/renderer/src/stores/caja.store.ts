import { create } from 'zustand'
import type { TurnoCaja, Venta } from '../../../shared/types'
import { invoke } from '../lib/api'

interface CajaState {
  turnoActual: TurnoCaja | null
  ventasDelTurno: Venta[]
  isLoading: boolean

  fetchTurno: (cajaId: number) => Promise<void>
  abrirTurno: (cajaId: number, usuarioId: number, montoApertura: number) => Promise<TurnoCaja>
  cerrarTurno: (turnoId: number, montoCierreDeclado: number) => Promise<TurnoCaja>
  fetchVentasDelTurno: () => Promise<void>
}

export const useCajaStore = create<CajaState>((set, get) => ({
  turnoActual: null,
  ventasDelTurno: [],
  isLoading: false,

  fetchTurno: async (cajaId) => {
    set({ isLoading: true })
    try {
      const turno = await invoke('turno:actual', { cajaId })
      set({ turnoActual: turno, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  abrirTurno: async (cajaId, usuarioId, montoApertura) => {
    const turno = await invoke('turno:abrir', { cajaId, usuarioId, montoApertura })
    set({ turnoActual: turno })
    return turno
  },

  cerrarTurno: async (turnoId, montoCierreDeclado) => {
    const turno = await invoke('turno:cerrar', { turnoId, montoCierreDeclado })
    set({ turnoActual: null, ventasDelTurno: [] })
    return turno
  },

  fetchVentasDelTurno: async () => {
    const { turnoActual } = get()
    if (!turnoActual) return
    const ventas = await invoke('ventas:list', { turnoId: turnoActual.id })
    set({ ventasDelTurno: ventas })
  },
}))
