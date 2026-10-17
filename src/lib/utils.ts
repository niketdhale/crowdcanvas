export interface Poster {
  id?: string | number
  title: string | null
  caption: string | null
  image_url: string
  target_url: string | null
  created_at: string
  image_path?: string
  status?: 'pending' | 'approved' | 'hidden'
  report_count?: number
}

export const MAX_BYTES = 5 * 1024 * 1024
export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/** '' -> null (no link), valid http(s) -> href, anything else -> false (invalid). */
export function normalizeDestination(value: string | null | undefined): string | null | false {
  const raw = String(value || '').trim()
  if (!raw) return null
  try {
    const url = new URL(raw)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : false
  } catch {
    return false
  }
}

export function filterPosters(posters: Poster[], query: string): Poster[] {
  const q = query.trim().toLowerCase()
  return posters.filter((p) => !q || `${p.title || ''} ${p.caption || ''}`.toLowerCase().includes(q))
}

/** Returns an error message, or null when the file is acceptable. */
export function validateFile(file: { type: string; size: number }): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return 'Please select a JPG, PNG or WebP image.'
  if (file.size > MAX_BYTES) return 'Image is larger than 5 MB. Choose a smaller file.'
  return null
}

export function prettyDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

/** Admin queue: anything not approved, or approved but reported. */
export const needsReview = (p: Poster) => p.status !== 'approved' || (p.report_count ?? 0) > 0
