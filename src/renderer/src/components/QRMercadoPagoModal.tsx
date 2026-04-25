import { useEffect, useRef, useState } from 'react'
import { invoke } from '../lib/api'
import { formatPrecio } from '../lib/format'

interface QRMercadoPagoModalProps {
  monto: number
  onConfirmado: () => void
  onCancelar: () => void
}

type Estado = 'cargando' | 'esperando' | 'aprobado' | 'rechazado' | 'cancelado' | 'timeout' | 'error'

const TIMEOUT_MS = 120_000
const POLL_INTERVAL_MS = 2_500

export function QRMercadoPagoModal({
  monto,
  onConfirmado,
  onCancelar,
}: QRMercadoPagoModalProps): JSX.Element {
  const [estado, setEstado] = useState<Estado>('cargando')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [qrData, setQrData] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const orderIdRef = useRef<string | null>(null)
  const estadoRef = useRef<Estado>('cargando')

  // Keep ref in sync so callbacks always have the latest value
  useEffect(() => {
    estadoRef.current = estado
  }, [estado])

  useEffect(() => {
    orderIdRef.current = orderId
  }, [orderId])

  function clearTimers(): void {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  async function cancelarOrden(id: string): Promise<void> {
    try {
      await invoke('mp:cancelarOrden', { orderId: id })
    } catch {
      // Silently ignore cancellation errors
    }
  }

  useEffect(() => {
    const externalReference = Date.now().toString()
    let mounted = true

    async function iniciarOrden(): Promise<void> {
      try {
        const result = await invoke('mp:crearOrden', {
          monto,
          descripcion: 'Venta POS',
          externalReference,
        })

        if (!mounted) return

        setQrData(result.qrData)
        setOrderId(result.orderId)
        orderIdRef.current = result.orderId
        setEstado('esperando')

        // Start polling
        pollRef.current = setInterval(async () => {
          if (estadoRef.current !== 'esperando') return
          try {
            const { estado: st } = await invoke('mp:consultarEstado', {
              orderId: result.orderId,
            })

            if (!mounted) return

            if (st === 'approved') {
              clearTimers()
              setEstado('aprobado')
              setTimeout(() => {
                if (mounted) onConfirmado()
              }, 1_500)
            } else if (st === 'rejected') {
              clearTimers()
              setEstado('rechazado')
            } else if (st === 'cancelled') {
              clearTimers()
              setEstado('cancelado')
            }
            // 'pending' → keep polling
          } catch {
            // Network glitch — keep polling, don't abort
          }
        }, POLL_INTERVAL_MS)

        // Global timeout
        timeoutRef.current = setTimeout(async () => {
          if (!mounted || estadoRef.current !== 'esperando') return
          clearTimers()
          setEstado('timeout')
          const currentId = orderIdRef.current
          if (currentId) await cancelarOrden(currentId)
          if (mounted) onCancelar()
        }, TIMEOUT_MS)
      } catch (err) {
        if (!mounted) return
        setErrorMsg(err instanceof Error ? err.message : 'Error al crear la orden')
        setEstado('error')
      }
    }

    void iniciarOrden()

    return () => {
      mounted = false
      clearTimers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCancelar(): Promise<void> {
    clearTimers()
    const currentId = orderIdRef.current
    if (currentId) await cancelarOrden(currentId)
    onCancelar()
  }

  const qrImageUrl =
    qrData !== null
      ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`
      : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#009EE3] px-6 py-4 text-white text-center">
          <p className="text-xs font-medium opacity-80 mb-1">MercadoPago QR</p>
          <p className="text-4xl font-bold">{formatPrecio(monto)}</p>
        </div>

        {/* Body */}
        <div className="flex flex-col items-center gap-4 p-6">
          {estado === 'cargando' && (
            <>
              <Spinner />
              <p className="text-slate-500 text-sm">Generando QR...</p>
            </>
          )}

          {estado === 'esperando' && (
            <>
              {qrImageUrl !== null ? (
                <img
                  src={qrImageUrl}
                  alt="QR MercadoPago"
                  className="rounded-xl border border-slate-200"
                  width={200}
                  height={200}
                />
              ) : (
                <Spinner />
              )}
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <Spinner small />
                <span>Esperando pago...</span>
              </div>
            </>
          )}

          {estado === 'aprobado' && (
            <div className="flex flex-col items-center gap-2">
              <span className="text-5xl">✓</span>
              <p className="text-green-600 font-bold text-lg">Pago confirmado</p>
            </div>
          )}

          {estado === 'rechazado' && (
            <div className="flex flex-col items-center gap-2">
              <span className="text-5xl">✗</span>
              <p className="text-red-500 font-bold text-lg">Pago rechazado</p>
              <p className="text-slate-400 text-sm text-center">
                El pago fue rechazado. Intentá con otro medio de pago.
              </p>
            </div>
          )}

          {estado === 'cancelado' && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-slate-500 font-bold">Orden cancelada</p>
            </div>
          )}

          {estado === 'timeout' && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-amber-600 font-bold">Tiempo agotado</p>
              <p className="text-slate-400 text-sm text-center">
                La orden expiró después de 2 minutos sin pago.
              </p>
            </div>
          )}

          {estado === 'error' && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-red-500 font-bold">Error</p>
              <p className="text-slate-500 text-sm text-center">{errorMsg}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          {(estado === 'cargando' || estado === 'esperando') && (
            <button
              onClick={handleCancelar}
              className="w-full py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
          )}

          {(estado === 'rechazado' || estado === 'cancelado' || estado === 'timeout' || estado === 'error') && (
            <button
              onClick={onCancelar}
              className="w-full py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Internal UI pieces
// ---------------------------------------------------------------------------

function Spinner({ small = false }: { small?: boolean }): JSX.Element {
  const size = small ? 'w-4 h-4 border-2' : 'w-10 h-10 border-4'
  return (
    <div
      className={`${size} rounded-full border-slate-200 border-t-[#009EE3] animate-spin`}
    />
  )
}
