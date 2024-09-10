import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { build } from 'esbuild'
import { describe, expect, test } from 'vitest'
import { dependencies } from '../package.json'
import UnpluginIsolatedDecl from '../src/esbuild'

describe('esbuild', () => {
  const input = path.resolve(__dirname, 'fixtures/main.ts')

  test('write mode', async () => {
    const dist = path.resolve(__dirname, 'temp')
    await build({
      entryPoints: [input],
      plugins: [UnpluginIsolatedDecl({ extraOutdir: 'temp' })],
      logLevel: 'silent',
      bundle: true,
      external: Object.keys(dependencies),
      platform: 'node',
      outdir: dist,
      format: 'esm',
    })

    const outDir = path.resolve(dist, 'temp')
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
      plugins: [UnpluginIsolatedDecl({ extraOutdir: 'temp' })],
      logLevel: 'silent',
      bundle: true,
      external: Object.keys(dependencies),
      platform: 'node',
      write: false,
      format: 'esm',
    })

    expect(
      outputFiles.map((file) => `// ${file.path}\n${file.text}`),
    ).toMatchSnapshot()
  })
})
