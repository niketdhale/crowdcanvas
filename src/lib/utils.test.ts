import { describe, expect, it } from 'vitest'
import { filterPosters, needsReview, normalizeDestination, validateFile, type Poster } from './utils'

const p = (title: string, caption = ''): Poster => ({ title, caption, image_url: 'x', target_url: null, created_at: '2024-01-01' })

describe('normalizeDestination', () => {
  it('rejects dangerous schemes', () => {
    expect(normalizeDestination('javascript:alert(1)')).toBe(false)
    expect(normalizeDestination('data:text/html,hi')).toBe(false)
    expect(normalizeDestination('not a url')).toBe(false)
  })
  it('accepts http(s) and blank', () => {
    expect(normalizeDestination('https://example.com')).toBe('https://example.com/')
    expect(normalizeDestination('  ')).toBeNull()
  })
})

describe('filterPosters', () => {
  it('matches title or caption, case-insensitive', () => {
    const list = [p('Sunset', 'warm'), p('Mountain', 'SNOW')]
    expect(filterPosters(list, 'sun')).toHaveLength(1)
    expect(filterPosters(list, 'snow')[0].title).toBe('Mountain')
    expect(filterPosters(list, '')).toHaveLength(2)
  })
})

describe('validateFile', () => {
  it('checks type and size', () => {
    expect(validateFile({ type: 'image/png', size: 100 })).toBeNull()
    expect(validateFile({ type: 'image/gif', size: 100 })).toMatch(/JPG/)
    expect(validateFile({ type: 'image/png', size: 6 * 1024 * 1024 })).toMatch(/5 MB/)
  })
})

describe('needsReview', () => {
  it('flags pending, hidden and reported posters only', () => {
    expect(needsReview({ ...p('a'), status: 'pending' })).toBe(true)
    expect(needsReview({ ...p('a'), status: 'hidden' })).toBe(true)
    expect(needsReview({ ...p('a'), status: 'approved', report_count: 1 })).toBe(true)
    expect(needsReview({ ...p('a'), status: 'approved', report_count: 0 })).toBe(false)
  })
})
