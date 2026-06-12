import { describe, it, expect } from 'vitest'
import { cn, getInitials } from '@/lib/utils'

describe('getInitials', () => {
  it('returns the first letter of the first two words, uppercased', () => {
    expect(getInitials('Jane Smith')).toBe('JS')
  })

  it('uses only the first two words for longer names', () => {
    expect(getInitials('Jane Middle Smith')).toBe('JM')
  })

  it('returns the first two letters uppercased for a single-word name', () => {
    expect(getInitials('jane')).toBe('JA')
  })

  it('trims surrounding whitespace before splitting', () => {
    expect(getInitials('  Jane   Smith  ')).toBe('JS')
  })

  it('falls back to the first letter of the email when the name is empty', () => {
    expect(getInitials('', 'jane@example.com')).toBe('J')
  })

  it('falls back to "?" when both name and email are missing', () => {
    expect(getInitials('')).toBe('?')
    expect(getInitials('', null)).toBe('?')
  })

  it('falls back to email when the name is only whitespace', () => {
    expect(getInitials('   ', 'amy@example.com')).toBe('A')
  })
})

describe('cn', () => {
  it('merges class names and resolves conflicting Tailwind utilities', () => {
    const result = cn('px-2 py-1', 'px-4')
    expect(result).toContain('px-4')
    expect(result).toContain('py-1')
    expect(result).not.toContain('px-2')
  })

  it('drops falsy values', () => {
    expect(cn('foo', false && 'bar', undefined, 'baz')).toBe('foo baz')
  })
})
