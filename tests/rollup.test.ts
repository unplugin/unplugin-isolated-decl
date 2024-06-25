import path from 'node:path'
import { expect, test } from 'vitest'
import { rollup } from 'rollup'
import UnpluginIsolatedDecl from '../src/rollup'

test('rollup', async () => {
  const dist = path.resolve(__dirname, 'temp')

  const bundle = await rollup({
    input: path.resolve(__dirname, '../src/index.ts'),
    plugins: [
      UnpluginIsolatedDecl({
        outDir: dist,
      }),
      { name: 'raw', transform: () => '' },
    ],
    logLevel: 'silent',
  })

  const result = await bundle.generate({
    dir: dist,
  })
  expect(
    result.output.map((asset) =>
      asset.type === 'chunk' ? asset.code : asset.source,
    ),
  ).toMatchSnapshot()
})
