import { defineConfig } from 'tsdown'
import IsolatedDecl from './src/rolldown'

export default defineConfig({
  entry: ['./src/*.ts'],
  dts: false,
  plugins: [IsolatedDecl()],
  target: false,
  publint: true,
})
