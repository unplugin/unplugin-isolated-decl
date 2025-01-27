import path from 'node:path'
import { expectFilesSnapshot } from '@sxzz/test-utils'
import type { ExpectStatic } from 'vitest'

export async function expectSnapshot(
  dir: string,
  name: string,
  expect?: ExpectStatic,
): Promise<void> {
  await expectFilesSnapshot(
    dir,
    path.resolve(__dirname, '__snapshots__', `${name}.md`),
    { expect },
  )
}
