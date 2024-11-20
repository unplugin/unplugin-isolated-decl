# unplugin-isolated-decl [![npm](https://img.shields.io/npm/v/unplugin-isolated-decl.svg)](https://npmjs.com/package/unplugin-isolated-decl) [![jsr](https://jsr.io/badges/@unplugin/isolated-decl)](https://jsr.io/@unplugin/isolated-decl)

[![Unit Test](https://github.com/unplugin/unplugin-isolated-decl/actions/workflows/unit-test.yml/badge.svg)](https://github.com/unplugin/unplugin-isolated-decl/actions/workflows/unit-test.yml)

⚡️ A blazing-fast tool for generating isolated declarations.

## Features

- 🚀 **Fast**: Generates `.d.ts` files significantly faster than `tsc`.
- 🎨 **Transformer**: Support Oxc, SWC, and TypeScript transformer.
- 📦 **Zero Config**: No configuration required, works out of the box.
- ✨ **Bundler Support**: Works with Vite, Rollup, esbuild and Farm. (PR of Webpack/Rspack support is welcome)

## Installation

```bash
# npm
npm i -D unplugin-isolated-decl

# jsr
npx jsr add -D @unplugin/isolated-decl
```

## Usage

<details>
<summary>Vite</summary><br>

```ts
// vite.config.ts
import UnpluginIsolatedDecl from 'unplugin-isolated-decl/vite'

export default defineConfig({
  plugins: [UnpluginIsolatedDecl()],
})
```

<br></details>

<details>
<summary>Rollup</summary><br>

```ts
// rollup.config.js
import UnpluginIsolatedDecl from 'unplugin-isolated-decl/rollup'

export default {
  plugins: [UnpluginIsolatedDecl()],
}
```

<br></details>

<details>
<summary>Rolldown</summary><br>

```ts
// rolldown.config.js
import UnpluginIsolatedDecl from 'unplugin-isolated-decl/rolldown'

export default {
  plugins: [UnpluginIsolatedDecl()],
}
```

<br></details>

<details>
<summary>esbuild</summary><br>

```ts
// esbuild.config.js
import { build } from 'esbuild'

build({
  plugins: [require('unplugin-isolated-decl/esbuild')()],
})
```

<br></details>

<details>
<summary>Farm</summary><br>

```ts
// farm.config.ts
import UnpluginIsolatedDecl from 'unplugin-isolated-decl/farm'

export default defineConfig({
  plugins: [UnpluginIsolatedDecl()],
})
```

<br></details>

## Options

```ts
export interface Options {
  include?: FilterPattern
  exclude?: FilterPattern
  enforce?: 'pre' | 'post' | undefined
  /**
   * You need to install one of the supported transformers yourself.
   * @default typescript
   */
  transformer?: 'oxc' | 'swc' | 'typescript'
  /** Only for typescript transformer */
  transformOptions?: TranspileOptions
  ignoreErrors?: boolean

  /** An extra directory layer for output files. */
  extraOutdir?: string
  /** Automatically add `.js` extension to resolve in `Node16` + ESM mode. */
  autoAddExts?: boolean
}
```

### `autoAddExts`

Automatically add `.js` extension to resolve in Node 16+ ESM mode.

```ts
// index.d.ts
import {} from './foo'
```

With `autoAddExts`, it will be transformed to:

```ts
// index.d.ts
import {} from './foo.js'
```

### `patchCjsDefaultExport`

Patch `export default` in `.d.cts` to `export =`

---

> [!NOTE]
> For the exhaustive set of options check [options](src/core/options.ts)

## Sponsors

<p align="center">
  <a href="https://cdn.jsdelivr.net/gh/sxzz/sponsors/sponsors.svg">
    <img src='https://cdn.jsdelivr.net/gh/sxzz/sponsors/sponsors.svg'/>
  </a>
</p>

## License

[MIT](./LICENSE) License © 2024-PRESENT [三咲智子](https://github.com/sxzz)
