import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { expect, test } from 'vitest'
import { build } from 'esbuild'
import UnpluginIsolatedDecl from '../src/esbuild'
import { dependencies } from '../package.json'

test('esbuild', async () => {
  const input = path.resolve(__dirname, 'fixtures/main.ts')
  const dist = path.resolve(__dirname, 'temp')

  await build({
    entryPoints: [input],
    plugins: [UnpluginIsolatedDecl()],
    logLevel: 'silent',
    bundle: true,
    external: Object.keys(dependencies),
    platform: 'node',
    outdir: dist,
  })

  expect(
    await readFile(path.resolve(dist, 'main.d.ts'), 'utf8'),
  ).toMatchSnapshot()
})
