import type { ServerResponse } from 'http'

export function ok<T>(res: ServerResponse, data: T, meta?: Record<string, unknown>): void {
  const body = JSON.stringify(meta ? { success: true, data, meta } : { success: true, data })
  res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders() })
  res.end(body)
}

export function created<T>(res: ServerResponse, data: T): void {
  const body = JSON.stringify({ success: true, data })
  res.writeHead(201, { 'Content-Type': 'application/json', ...corsHeaders() })
  res.end(body)
}

export function error(res: ServerResponse, status: number, message: string): void {
  const body = JSON.stringify({ success: false, error: message })
  res.writeHead(status, { 'Content-Type': 'application/json', ...corsHeaders() })
  res.end(body)
}

export function preflight(res: ServerResponse): void {
  res.writeHead(204, corsHeaders())
  res.end()
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, X-API-Key, Content-Type',
  }
}
