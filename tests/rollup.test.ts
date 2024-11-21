import fs from 'node:fs/promises'
import path from 'node:path'
import { outputToSnapshot } from '@sxzz/test-utils'
import { rollup } from 'rollup'
import esbuild from 'rollup-plugin-esbuild'
import { describe, expect, test } from 'vitest'
import UnpluginIsolatedDecl from '../src/rollup'

async function getFileSnapshot(dir: string) {
  /**
   * Map written output from file system rather than from bundle due to
   * module execution order not consistent
   *
   * @see https://github.com/rollup/rollup/issues/3888
   */
  const files = (
    await fs.readdir(dir, { recursive: true, withFileTypes: true })
  ).filter((it) => it.isFile())

  const snapshot = await Promise.all(
    files.map(async (it) => {
      const absolute = path.resolve(it.parentPath, it.name)
      const filePath = path.relative(dir, absolute)
      const content = await fs.readFile(absolute, 'utf-8')

      return `// ${filePath.replaceAll('\\', '/')}\n${content.toString()}`
    }),
  )
  return snapshot
}

describe('rollup', () => {
  const TEST_SANDBOX_FOLDER = 'temp/rollup'

  test('generate basic', async () => {
    const input = path.resolve(__dirname, 'fixtures/basic/main.ts')
    const dist = path.resolve(__dirname, `${TEST_SANDBOX_FOLDER}/basic`)

    const bundle = await rollup({
      input,
      plugins: [
        UnpluginIsolatedDecl({
          extraOutdir: 'temp',
        }),
        esbuild(),
      ],
      logLevel: 'silent',
    })

    const result = await bundle.generate({
      dir: dist,
    })

    expect(outputToSnapshot(result.output)).toMatchSnapshot()
  })

  test('write entry-points', async () => {
    const input = {
      a: path.resolve(__dirname, 'fixtures/entry-points/a/index.ts'),
      b: path.resolve(__dirname, 'fixtures/entry-points/b/index.ts'),
    }
    const dist = path.resolve(__dirname, `${TEST_SANDBOX_FOLDER}/entry-points`)

    const bundle = await rollup({
      input,
      plugins: [UnpluginIsolatedDecl(), esbuild()],
      logLevel: 'silent',
    })

    // https://github.com/unplugin/unplugin-isolated-decl/issues/22
    await bundle.write({
      dir: dist,
      entryFileNames: '[name]/index.js',
      preserveModules: true,
    })

    expect(await getFileSnapshot(dist)).toMatchSnapshot()
  })

  test('write entry-points (#34)', async () => {
    const input = {
      index: path.resolve(__dirname, 'fixtures/entry-points2/index.ts'),
      bar: path.resolve(__dirname, 'fixtures/entry-points2/foo/bar/index.ts'),
    }
    const dist = path.resolve(__dirname, `${TEST_SANDBOX_FOLDER}/entry-points2`)

    const bundle = await rollup({
      input,
      plugins: [
        UnpluginIsolatedDecl({
          autoAddExts: true,
        }),
        esbuild(),
      ],
      logLevel: 'silent',
    })

    await bundle.write({ dir: dist })

    expect(await getFileSnapshot(dist)).toMatchSnapshot()
  })
})
