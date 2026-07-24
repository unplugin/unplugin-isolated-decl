import { defineConfig } from 'tsdown'
import IsolatedDecl from './src/rolldown.ts'

export default defineConfig({
  entry: ['./src/*.ts'],
  dts: false,
  plugins: [IsolatedDecl()],
  target: false,
  exports: true,
  publint: 'ci-only',
  attw: {
    enabled: 'ci-only',
    profile: 'esm-only',
  },
})
