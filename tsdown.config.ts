import { defineConfig } from 'tsdown'
import IsolatedDecl from './src/rolldown'

export default defineConfig({
  entry: ['./src/*.ts'],
  format: ['cjs', 'esm'],
  clean: true,
  plugins: [
    IsolatedDecl({
      patchCjsDefaultExport: true,
    }),
  ],
  publint: true,
})
