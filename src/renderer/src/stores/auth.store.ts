import { create } from 'zustand'
import type { Usuario } from '../../../shared/types'
import { invoke } from '../lib/api'

interface AuthState {
  usuario: Usuario | null
  isLoading: boolean
  error: string | null
  login: (pin: string) => Promise<boolean>
  logout: () => void
  setUsuario: (usuario: Usuario) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  usuario: null,
  isLoading: false,
  error: null,

  login: async (pin) => {
    set({ isLoading: true, error: null })
    try {
      const usuario = await invoke('usuarios:login', { pin })
      set({ usuario, isLoading: false })
      return true
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Error al iniciar sesión', isLoading: false })
      return false
    }
  },

  logout: () => set({ usuario: null, error: null }),

  setUsuario: (usuario) => set({ usuario }),
}))
