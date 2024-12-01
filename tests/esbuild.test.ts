import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { outputToSnapshot } from '@sxzz/test-utils'
import { build } from 'esbuild'
import { describe, expect, test } from 'vitest'
import { dependencies } from '../package.json'
import UnpluginIsolatedDecl from '../src/esbuild'

describe('esbuild', () => {
  const input = path.resolve(__dirname, 'fixtures/basic/main.ts')

  test('write mode', async () => {
    const dist = path.resolve(__dirname, 'temp/esbuild/basic')
    await build({
      entryPoints: [input],
      plugins: [
        UnpluginIsolatedDecl({
          extraOutdir: 'extraOutdir',
          sourceMap: true,
        }),
      ],
      logLevel: 'silent',
      bundle: true,
      external: Object.keys(dependencies),
      platform: 'node',
      outdir: dist,
      format: 'esm',
    })

    const outDir = path.resolve(dist, 'extraOutdir')
    await expect(
      Promise.all(
        (await readdir(outDir))
          .sort()
          .map((file) => readFile(path.resolve(outDir, file), 'utf8')),
      ),
    ).resolves.toMatchSnapshot()
  })

  test('generate mode', async () => {
    const { outputFiles } = await build({
      entryPoints: [input],
      plugins: [
        UnpluginIsolatedDecl({
          extraOutdir: 'temp',
        }),
      ],
      logLevel: 'silent',
      bundle: true,
      external: Object.keys(dependencies),
      platform: 'node',
      write: false,
      format: 'esm',
    })

    expect(outputToSnapshot(outputFiles)).toMatchSnapshot()
  })
})
