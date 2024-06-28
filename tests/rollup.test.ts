import path from 'node:path'
import { expect, test } from 'vitest'
import { rollup } from 'rollup'
import UnpluginIsolatedDecl from '../src/rollup'

test('rollup', async () => {
  const input = path.resolve(__dirname, 'fixtures/main.ts')
  const dist = path.resolve(__dirname, 'temp')

  const bundle = await rollup({
    input,
    plugins: [UnpluginIsolatedDecl(), { name: 'raw', transform: () => '' }],
    logLevel: 'silent',
  })

  const result = await bundle.generate({
    dir: dist,
  })
  expect(
    result.output.map(
      (asset) =>
        `// ${asset.fileName}\n${asset.type === 'chunk' ? asset.code : asset.source}`,
    ),
  ).toMatchSnapshot()
})
