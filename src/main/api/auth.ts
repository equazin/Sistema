import { createHash, timingSafeEqual, randomBytes } from 'crypto'

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

export function generateApiKey(): { raw: string; hash: string; preview: string } {
  const raw = 'sk_pos_' + randomBytes(24).toString('hex')
  const hash = hashApiKey(raw)
  const preview = raw.slice(0, 10) + '••••' + raw.slice(-4)
  return { raw, hash, preview }
}

export function validateApiKey(provided: string, storedHash: string): boolean {
  try {
    const providedHash = hashApiKey(provided)
    const a = Buffer.from(providedHash, 'hex')
    const b = Buffer.from(storedHash, 'hex')
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}
