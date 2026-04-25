import * as https from 'node:https'
import { handle } from './base'
import { getSqlite } from '../db/database'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MpConfig {
  accessToken: string
  posId: string
  sucursalId: string
}

interface MpUserMe {
  id: number
}

interface MpOrdenCreada {
  id: string
  qr_data: string
  ticket_url: string
}

interface MpOrdenActiva {
  status: string
  order_id: string
  external_reference?: string
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

function mpRequest(
  method: string,
  path: string,
  token: string,
  body?: unknown
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const bodyStr = body !== undefined ? JSON.stringify(body) : undefined
    const options: https.RequestOptions = {
      hostname: 'api.mercadopago.com',
      port: 443,
      path,
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(bodyStr !== undefined ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    }

    const req = https.request(options, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf-8')
        if (res.statusCode !== undefined && res.statusCode >= 400) {
          reject(new Error(`MercadoPago API error ${res.statusCode}: ${raw}`))
          return
        }
        try {
          resolve(raw.length > 0 ? JSON.parse(raw) : null)
        } catch {
          reject(new Error(`MercadoPago API: respuesta no válida: ${raw}`))
        }
      })
    })

    req.on('error', (err: Error) => reject(err))

    if (bodyStr !== undefined) {
      req.write(bodyStr)
    }
    req.end()
  })
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

function getNegocioId(): number {
  const db = getSqlite()
  const row = db.prepare('SELECT id FROM negocios LIMIT 1').get() as { id: number } | undefined
  if (!row) throw new Error('No hay negocio configurado')
  return row.id
}

function getMpConfig(): MpConfig | null {
  const db = getSqlite()
  const negocioId = getNegocioId()
  const row = db.prepare(
    'SELECT valor FROM configuracion WHERE negocio_id = ? AND clave = ?'
  ).get(negocioId, 'mp_config') as { valor: string } | undefined

  if (!row) return null

  try {
    const parsed = JSON.parse(row.valor) as unknown
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'accessToken' in parsed &&
      'posId' in parsed &&
      'sucursalId' in parsed &&
      typeof (parsed as Record<string, unknown>).accessToken === 'string' &&
      typeof (parsed as Record<string, unknown>).posId === 'string' &&
      typeof (parsed as Record<string, unknown>).sucursalId === 'string'
    ) {
      return parsed as MpConfig
    }
    return null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// User ID cache (per-process, refreshed lazily)
// ---------------------------------------------------------------------------

let cachedUserId: number | null = null

async function getMpUserId(token: string): Promise<number> {
  if (cachedUserId !== null) return cachedUserId
  const data = await mpRequest('GET', '/users/me', token) as MpUserMe
  cachedUserId = data.id
  return data.id
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export function registerMercadoPagoHandlers(): void {
  // ── config:mp:get ──────────────────────────────────────────────────────
  handle('config:mp:get', () => {
    return getMpConfig()
  })

  // ── config:mp:set ──────────────────────────────────────────────────────
  handle('config:mp:set', ({ accessToken, posId, sucursalId }) => {
    const db = getSqlite()
    const negocioId = getNegocioId()
    const valor = JSON.stringify({ accessToken, posId, sucursalId })

    db.prepare(`
      INSERT INTO configuracion (negocio_id, clave, valor)
      VALUES (?, ?, ?)
      ON CONFLICT(negocio_id, clave) DO UPDATE SET valor = excluded.valor
    `).run(negocioId, 'mp_config', valor)

    // Invalidate user-id cache when credentials change
    cachedUserId = null
  })

  // ── mp:crearOrden ──────────────────────────────────────────────────────
  handle('mp:crearOrden', async ({ monto, descripcion, externalReference }) => {
    const config = getMpConfig()
    if (!config) throw new Error('MercadoPago no está configurado. Configurá las credenciales en Configuración.')

    const userId = await getMpUserId(config.accessToken)

    const path = `/instore/orders/qr/seller/collectors/${userId}/pos/${config.posId}/qrs`
    const body = {
      external_reference: externalReference,
      title: 'Venta POS',
      description: descripcion,
      total_amount: monto,
      items: [
        {
          title: descripcion,
          unit_price: monto,
          quantity: 1,
          unit_measure: 'unit',
          total_amount: monto,
        },
      ],
    }

    const data = await mpRequest('POST', path, config.accessToken, body) as MpOrdenCreada

    return {
      orderId: data.id,
      qrData: data.qr_data,
      ticketUrl: data.ticket_url,
    }
  })

  // ── mp:consultarEstado ─────────────────────────────────────────────────
  handle('mp:consultarEstado', async ({ orderId }) => {
    const config = getMpConfig()
    if (!config) throw new Error('MercadoPago no está configurado.')

    const userId = await getMpUserId(config.accessToken)

    const path = `/instore/qr/seller/collectors/${userId}/pos/${config.posId}/orders`
    const data = await mpRequest('GET', path, config.accessToken) as MpOrdenActiva

    // The endpoint returns the active order for the POS. We match by order_id.
    if (data.order_id === orderId || data.external_reference === orderId) {
      const raw = data.status
      const estado = normalizeEstado(raw)
      return { estado }
    }

    // If no matching active order, assume it was cancelled/expired
    return { estado: 'cancelled' as const }
  })

  // ── mp:cancelarOrden ───────────────────────────────────────────────────
  handle('mp:cancelarOrden', async ({ orderId }) => {
    const config = getMpConfig()
    if (!config) throw new Error('MercadoPago no está configurado.')

    const userId = await getMpUserId(config.accessToken)

    const path = `/instore/orders/qr/seller/collectors/${userId}/pos/${config.posId}/qrs`
    await mpRequest('DELETE', path, config.accessToken)

    // orderId is logged for traceability but the MP API cancels by POS, not by order id
    void orderId
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeEstado(raw: string): 'pending' | 'approved' | 'rejected' | 'cancelled' {
  switch (raw) {
    case 'approved':
    case 'authorized':
      return 'approved'
    case 'rejected':
    case 'refunded':
    case 'charge_back':
      return 'rejected'
    case 'cancelled':
    case 'expired':
      return 'cancelled'
    default:
      return 'pending'
  }
}
