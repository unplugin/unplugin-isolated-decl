import fs from 'node:fs/promises'
import path from 'node:path'
import { rollup } from 'rollup'
import esbuild from 'rollup-plugin-esbuild'
import { describe, expect, test } from 'vitest'
import UnpluginIsolatedDecl from '../src/rollup'

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

    expect(
      result.output.map((asset) =>
        [
          `// ${asset.fileName.replaceAll('\\', '/')}`,
          asset.type === 'chunk' ? asset.code : asset.source,
        ].join('\n'),
      ),
    ).toMatchSnapshot()
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

    /**
     * Map written output from file system rather than from bundle due to
     * module execution order not consistent
     *
     * @see https://github.com/rollup/rollup/issues/3888
     */
    const allBundledFiles = (
      await fs.readdir(dist, {
        recursive: true,
        withFileTypes: true,
      })
    ).filter((it) => it.isFile())

    const fileSystemOutput = allBundledFiles.map((it) => {
      return (async () => {
        const filePath = path.relative(dist, path.join(it.parentPath, it.name))

        const content = await fs.readFile(path.join(dist, filePath), 'utf-8')

        return [
          `// ${filePath.replaceAll('\\', '/')}`,
          content.toString(),
        ].join('\n')
      })()
    })

    expect(await Promise.all(fileSystemOutput)).toMatchSnapshot()
  })
})
