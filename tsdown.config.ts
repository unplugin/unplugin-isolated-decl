import { defineConfig } from 'tsdown'
import IsolatedDecl from './src/rolldown'

export default defineConfig({
  entry: ['./src/*.ts'],
  format: ['cjs', 'esm'],
  splitting: true,
  clean: true,
  plugins: [IsolatedDecl()],
})
