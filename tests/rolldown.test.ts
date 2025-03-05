import path from 'node:path'
import { outputToSnapshot } from '@sxzz/test-utils'
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
      }),
    ],
    logLevel: 'silent',
  })

  const result = await bundle.generate({
    dir: dist,
  })
  expect(outputToSnapshot(result.output)).toMatchSnapshot()
})
