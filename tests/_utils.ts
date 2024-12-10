import path from 'node:path'
import { expectFilesSnapshot } from '@sxzz/test-utils'

export async function expectSnapshot(
  dir: string,
  name: string,
  pattern = '**/*',
): Promise<void> {
  await expectFilesSnapshot(
    dir,
    path.resolve(__dirname, '__snapshots__', `${name}.md`),
    pattern,
  )
}
