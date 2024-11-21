import { rm } from 'node:fs/promises'
import path from 'node:path'

await rm(path.resolve(__dirname, 'tests/temp'), {
  force: true,
  recursive: true,
})
