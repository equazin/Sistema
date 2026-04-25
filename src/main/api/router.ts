import type { IncomingMessage, ServerResponse } from 'http'
import { URL } from 'url'

export function parseQuery(rawUrl: string): Record<string, string | string[]> {
  try {
    const u = new URL(rawUrl, 'http://localhost')
    const result: Record<string, string | string[]> = {}
    u.searchParams.forEach((v, k) => { result[k] = v })
    return result
  } catch {
    return {}
  }
}

export function parsePagination(query: Record<string, string | string[]>): { page: number; limit: number; offset: number } {
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1)
  const limit = Math.min(200, Math.max(1, parseInt(String(query.limit ?? '50'), 10) || 50))
  return { page, limit, offset: (page - 1) * limit }
}

export function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk: Buffer) => {
      data += chunk.toString()
      if (data.length > 1_000_000) reject(new Error('Body too large'))
    })
    req.on('end', () => {
      try { resolve(JSON.parse(data)) } catch { reject(new Error('Invalid JSON')) }
    })
    req.on('error', reject)
  })
}

export function getPathParts(url: string): string[] {
  try {
    const u = new URL(url, 'http://localhost')
    return u.pathname.split('/').filter(Boolean)
  } catch {
    return []
  }
}
