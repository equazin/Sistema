interface Bucket {
  tokens: number
  lastRefill: number
}

const buckets = new Map<string, Bucket>()
const LIMIT = 60
const WINDOW_MS = 60_000

export function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  let bucket = buckets.get(ip)
  if (!bucket) {
    bucket = { tokens: LIMIT - 1, lastRefill: now }
    buckets.set(ip, bucket)
    return true
  }
  const elapsed = now - bucket.lastRefill
  const refill = Math.floor((elapsed / WINDOW_MS) * LIMIT)
  if (refill > 0) {
    bucket.tokens = Math.min(LIMIT, bucket.tokens + refill)
    bucket.lastRefill = now
  }
  if (bucket.tokens <= 0) return false
  bucket.tokens--
  return true
}

// Prevent memory leak: clean old buckets every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS * 5
  for (const [ip, b] of buckets) {
    if (b.lastRefill < cutoff) buckets.delete(ip)
  }
}, 5 * 60_000).unref()
