import { defineConfig } from '@farmfe/core'
// import UnpluginIsolatedDecl from 'unplugin-isolated-decl/vite'

export default defineConfig({
  compilation: {
    input: {
      index: 'src/index.ts',
    },
    output: {
      targetEnv: 'node',
    },
  },
  // plugins: [UnpluginIsolatedDecl({
  //   transformer: 'oxc'
  // })]
})
