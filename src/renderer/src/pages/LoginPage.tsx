import { useState, useCallback, KeyboardEvent } from 'react'
import { useAuthStore } from '../stores/auth.store'

export function LoginPage(): JSX.Element {
  const [pin, setPin] = useState('')
  const { login, isLoading, error } = useAuthStore()

  const handleSubmit = useCallback(async () => {
    if (pin.length < 4) return
    const ok = await login(pin)
    if (!ok) setPin('')
  }, [pin, login])

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSubmit()
  }, [handleSubmit])

  const handleDigit = useCallback((digit: string) => {
    setPin((prev) => prev.length < 6 ? prev + digit : prev)
  }, [])

  const handleDelete = useCallback(() => {
    setPin((prev) => prev.slice(0, -1))
  }, [])

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-80">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-800">Sistema POS</h1>
          <p className="text-slate-500 text-sm mt-1">Ingresá tu PIN para continuar</p>
        </div>

        <div className="mb-6">
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={handleKeyDown}
            placeholder="••••"
            className="w-full text-center text-3xl tracking-widest border-2 border-slate-200 rounded-xl py-3 outline-none focus:border-blue-500 transition-colors"
            autoFocus
            inputMode="numeric"
          />
          {error && (
            <p className="text-red-500 text-sm text-center mt-2">{error}</p>
          )}
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {['1','2','3','4','5','6','7','8','9'].map((d) => (
            <button
              key={d}
              onClick={() => handleDigit(d)}
              className="bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 text-xl font-semibold rounded-xl py-4 transition-colors"
            >
              {d}
            </button>
          ))}
          <button
            onClick={handleDelete}
            className="bg-slate-100 hover:bg-slate-200 text-slate-500 text-sm font-semibold rounded-xl py-4 transition-colors"
          >
            ⌫
          </button>
          <button
            onClick={() => handleDigit('0')}
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xl font-semibold rounded-xl py-4 transition-colors"
          >
            0
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || pin.length < 4}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-bold rounded-xl py-4 transition-colors"
          >
            {isLoading ? '...' : '✓'}
          </button>
        </div>

        <p className="text-center text-xs text-slate-400">PIN por defecto: 1234</p>
      </div>
    </div>
  )
}
