import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

export async function getFileSnapshot(dir: string): Promise<string[]> {
  /**
   * Map written output from file system rather than from bundle due to
   * module execution order not consistent
   *
   * @see https://github.com/rollup/rollup/issues/3888
   */
  const files = (
    await readdir(dir, { recursive: true, withFileTypes: true })
  ).filter((it) => it.isFile())

  const snapshot = await Promise.all(
    files.map(async (it) => {
      const absolute = path.resolve(it.parentPath, it.name)
      const filePath = path.relative(dir, absolute)
      const content = await readFile(absolute, 'utf-8')

      return `// ${filePath.replaceAll('\\', '/')}\n${content.toString()}`
    }),
  )
  return snapshot
}
