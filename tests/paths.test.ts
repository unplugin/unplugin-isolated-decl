import { expect, test } from 'vitest'
import { lowestCommonAncestor } from '../src'

test('lowestCommonAncestor', () => {
  expect(lowestCommonAncestor('/a/b', '/a')).toBe('/a')
  expect(lowestCommonAncestor(String.raw`C:\a\b`, String.raw`C:\a`)).toBe(
    'C:/a',
  )
  expect(lowestCommonAncestor(String.raw`C:\a\b`, 'C:/a/b')).toBe('C:/a/b')
})
