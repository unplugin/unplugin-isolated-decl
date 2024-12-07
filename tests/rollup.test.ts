import path from 'node:path'
import alias from '@rollup/plugin-alias'
import { outputToSnapshot } from '@sxzz/test-utils'
import { rollup } from 'rollup'
import esbuild from 'rollup-plugin-esbuild'
import { describe, expect, test } from 'vitest'
import UnpluginIsolatedDecl from '../src/rollup'
import { getFileSnapshot } from './_utils'

describe('rollup', () => {
  const fixtures = path.resolve(__dirname, 'fixtures')
  const TEST_SANDBOX_FOLDER = path.resolve(__dirname, 'temp/rollup')

  test('generate basic', async () => {
    const dir = 'basic'
    const input = path.resolve(fixtures, dir, 'main.ts')

    const bundle = await rollup({
      input,
      plugins: [
        UnpluginIsolatedDecl({
          extraOutdir: 'temp',
          autoAddExts: true,
        }),
        esbuild(),
      ],
      logLevel: 'silent',
    })
    const result = await bundle.generate({})

    expect(outputToSnapshot(result.output)).toMatchSnapshot()
  })

  test('with exts', async () => {
    const dir = 'with-exts'
    const input = path.resolve(fixtures, dir, 'main.ts')

    const bundle = await rollup({
      input,
      plugins: [UnpluginIsolatedDecl(), esbuild()],
      logLevel: 'silent',
    })
    const result = await bundle.generate({})

    expect(outputToSnapshot(result.output)).toMatchSnapshot()
  })

  test('write entry-points (#22)', async () => {
    const dir = 'entry-points-22'
    const input = {
      a: path.resolve(fixtures, dir, 'a/index.ts'),
      b: path.resolve(fixtures, dir, 'b/index.ts'),
    }
    const dist = path.resolve(TEST_SANDBOX_FOLDER, dir)

    const bundle = await rollup({
      input,
      plugins: [
        UnpluginIsolatedDecl({
          autoAddExts: true,
          sourceMap: true,
        }),
        esbuild(),
      ],
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
    const dir = 'entry-points-34'
    const input = {
      index: path.resolve(fixtures, dir, 'main.ts'),
      'foo/bar': path.resolve(fixtures, dir, 'foo/bar/bar.ts'),
    }
    const dist = path.resolve(TEST_SANDBOX_FOLDER, dir)

    const bundle = await rollup({
      input,
      plugins: [
        UnpluginIsolatedDecl({
          autoAddExts: true,
          sourceMap: true,
        }),
        esbuild(),
      ],
      logLevel: 'silent',
    })

    await bundle.write({ dir: dist })

    expect(await getFileSnapshot(dist)).toMatchSnapshot()
  })

  test('custom rewriter', async () => {
    const dir = 'import-rewriter'
    const input = path.resolve(fixtures, dir, 'index.ts')

    let importer
    const bundle = await rollup({
      input,
      plugins: [
        alias({
          entries: [{ find: '~', replacement: '.' }],
        }),
        UnpluginIsolatedDecl({
          autoAddExts: true,
          rewriteImports(id, _importer) {
            if (id[0] === '~') {
              importer = _importer
              return `.${id.slice(1)}`
            }
          },
        }),
        esbuild(),
      ],
      logLevel: 'silent',
    })
    const result = await bundle.generate({})

    expect(outputToSnapshot(result.output)).toMatchSnapshot()
    expect(importer).toBe(path.resolve(fixtures, dir, 'index.ts'))
  })

  test('no index path', async () => {
    const dir = 'no-index'
    const input = path.resolve(fixtures, dir, 'main.ts')
    const dist = path.resolve(TEST_SANDBOX_FOLDER, dir)

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
