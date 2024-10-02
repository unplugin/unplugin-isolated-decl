import path from 'node:path'
import { rolldown } from 'rolldown'
import { expect, test } from 'vitest'
import UnpluginIsolatedDecl from '../src/rolldown'

test('rolldown', async () => {
  const input = path.resolve(__dirname, 'fixtures/basic/main.ts')
  const dist = path.resolve(__dirname, 'temp/rolldown/basic')

  const bundle = await rolldown({
    input,
    plugins: [
      UnpluginIsolatedDecl({
        extraOutdir: 'temp',
        transformer: 'oxc',
      }),
    ],
    logLevel: 'silent',
  })

  const result = await bundle.generate({
    dir: dist,
  })
  expect(
    result.output
      .sort((a, b) => a.fileName.localeCompare(b.fileName))
      .map(
        (asset) =>
          `// ${asset.fileName.replaceAll('\\', '/')}\n${asset.type === 'chunk' ? asset.code : asset.source}`,
      ),
  ).toMatchSnapshot()
})
