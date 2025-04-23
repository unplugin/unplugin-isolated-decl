import path from 'node:path'
import alias from '@rollup/plugin-alias'
import { outputToSnapshot } from '@sxzz/test-utils'
import { rollup } from 'rollup'
import Oxc from 'unplugin-oxc/rollup'
import { describe, test } from 'vitest'
import UnpluginIsolatedDecl from '../src/rollup'
import { expectSnapshot } from './_utils'

describe.concurrent('rollup', () => {
  const fixtures = path.resolve(__dirname, 'fixtures')
  const TEST_SANDBOX_FOLDER = path.resolve(__dirname, 'temp/rollup')

  test('generate basic', async ({ expect }) => {
    const dir = 'basic'
    const input = path.resolve(fixtures, dir, 'main.ts')

    const bundle = await rollup({
      input,
      plugins: [UnpluginIsolatedDecl(), Oxc()],
      logLevel: 'silent',
    })
    const result = await bundle.generate({})

    expect(outputToSnapshot(result.output)).toMatchSnapshot()
  })

  test(`keep ext`, async ({ expect }) => {
    const dir = 'keep-ext'
    const input = path.resolve(fixtures, dir, 'main.ts')

    const bundle = await rollup({
      input,
      plugins: [UnpluginIsolatedDecl(), Oxc()],
      logLevel: 'silent',
    })
    const result = await bundle.generate({})

    expect(outputToSnapshot(result.output)).toMatchSnapshot()
  })

  test(`extraOutdir`, async ({ expect }) => {
    const dir = 'extra-outdir'
    const input = path.resolve(fixtures, dir, 'main.ts')
    const dist = path.resolve(TEST_SANDBOX_FOLDER, dir)

    const bundle = await rollup({
      input,
      plugins: [UnpluginIsolatedDecl({ extraOutdir: 'types' }), Oxc()],
      logLevel: 'silent',
    })
    await bundle.write({ dir: dist })

    await expectSnapshot(dist, `rollup/${dir}`, expect)
  })

  test('write entry-points (#22)', async ({ expect }) => {
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
          sourceMap: true,
        }),
        Oxc(),
      ],
      logLevel: 'silent',
    })

    // https://github.com/unplugin/unplugin-isolated-decl/issues/22
    await bundle.write({
      dir: dist,
      entryFileNames: '[name]/index.js',
      preserveModules: true,
    })

    await expectSnapshot(dist, `rollup/${dir}`, expect)
  })

  test('write entry-points (#34)', async ({ expect }) => {
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
          sourceMap: true,
        }),
        Oxc(),
      ],
      logLevel: 'silent',
    })

    await bundle.write({ dir: dist })

    await expectSnapshot(dist, `rollup/${dir}`, expect)
  })

  test('custom rewriter', async ({ expect }) => {
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
          rewriteImports(id, _importer) {
            if (id[0] === '~') {
              importer = _importer
              return `.${id.slice(1)}`
            }
          },
        }),
        Oxc(),
      ],
      logLevel: 'silent',
    })
    const result = await bundle.generate({})

    expect(outputToSnapshot(result.output)).toMatchSnapshot()
    expect(importer).toBe(path.resolve(fixtures, dir, 'index.ts'))
  })

  test('no index path', async ({ expect }) => {
    const dir = 'no-index'
    const input = path.resolve(fixtures, dir, 'main.ts')
    const dist = path.resolve(TEST_SANDBOX_FOLDER, dir)

    const bundle = await rollup({
      input,
      plugins: [UnpluginIsolatedDecl(), Oxc()],
      logLevel: 'silent',
    })

    await bundle.write({ dir: dist })

    await expectSnapshot(dist, `rollup/${dir}`, expect)
  })

  test('ignore errors', async ({ expect }) => {
    const dir = 'ignore-errors'
    const input = path.resolve(fixtures, dir, 'main.ts')
    const dist = path.resolve(TEST_SANDBOX_FOLDER, dir)

    const bundle = await rollup({
      input,
      plugins: [UnpluginIsolatedDecl({ ignoreErrors: true }), Oxc()],
      logLevel: 'silent',
    })

    await bundle.write({ dir: dist })

    await expectSnapshot(dist, `rollup/${dir}`, expect)
  })

  test('oxc options', async ({ expect }) => {
    const dir = 'oxc-options'
    const input = path.resolve(fixtures, dir, 'main.ts')
    const dist = path.resolve(TEST_SANDBOX_FOLDER, dir)

    const bundle = await rollup({
      input,
      plugins: [
        UnpluginIsolatedDecl({
          transformer: 'oxc',
          transformOptions: { stripInternal: true },
        }),
        Oxc(),
      ],
      logLevel: 'silent',
    })

    await bundle.write({ dir: dist })

    await expectSnapshot(dist, `rollup/${dir}`, expect)
  })

  test('type only imports', async ({ expect }) => {
    const dir = 'type-only'
    const input = path.resolve(fixtures, dir, 'main.ts')
    const dist = path.resolve(TEST_SANDBOX_FOLDER, dir)

    const bundle = await rollup({
      input,
      plugins: [UnpluginIsolatedDecl(), Oxc()],
      logLevel: 'silent',
    })

    await bundle.write({ dir: dist })

    await expectSnapshot(dist, `rollup/${dir}`, expect)
  })
})
