import { defineConfig } from 'tsdown'
import IsolatedDecl from './src/rolldown'

export default defineConfig({
  entry: ['./src/*.ts'],
  format: ['esm'],
  clean: true,
  plugins: [IsolatedDecl()],
  publint: true,
})
