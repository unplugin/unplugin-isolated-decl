import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { glob } from 'tinyglobby'

export async function getFileSnapshot(
  dir: string,
  pattern = '**/*',
): Promise<string> {
  /**
   * Map written output from file system rather than from bundle due to
   * module execution order not consistent
   *
   * @see https://github.com/rollup/rollup/issues/3888
   */
  const files = await glob(pattern, { cwd: dir })
  const snapshot = await Promise.all(
    files.map(async (it) => {
      const absolute = path.resolve(dir, it)
      const filePath = path.relative(dir, absolute)
      const content = await readFile(absolute, 'utf-8')

      return `// ${filePath.replaceAll('\\', '/')}\n${content.toString()}`
    }),
  )
  return snapshot.sort().join('\n\n')
}
