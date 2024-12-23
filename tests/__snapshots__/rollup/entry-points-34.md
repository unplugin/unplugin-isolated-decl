## foo/bar.d.ts

```ts
export type * from './bar/baz.js';
export type * from '../index.js';
//# sourceMappingURL=bar.d.ts.map
```
## foo/bar.d.ts.map

```map
{"version":3,"file":"bar.d.ts","sourceRoot":"","sources":["../../../../fixtures/entry-points-34/foo/bar/bar.ts"],"names":[],"mappings":"AAAA,mBAAmB,OAAO,CAAA;AAC1B,mBAAmB,YAAY,CAAA"}
```
## foo/bar.js

```js


```
## foo/bar/baz.d.ts

```ts
export type * from '../bar.js';
export type * from '../../index.js';
//# sourceMappingURL=baz.d.ts.map
```
## foo/bar/baz.d.ts.map

```map
{"version":3,"file":"baz.d.ts","sourceRoot":"","sources":["../../../../../fixtures/entry-points-34/foo/bar/baz.ts"],"names":[],"mappings":"AAAA,mBAAmB,UAAU,CAAA;AAC7B,mBAAmB,YAAY,CAAA"}
```
## index.d.ts

```ts
export * from './foo/bar.js';
export * from './foo/bar/baz.js';
//# sourceMappingURL=index.d.ts.map
```
## index.d.ts.map

```map
{"version":3,"file":"index.d.ts","sourceRoot":"","sources":["../../../fixtures/entry-points-34/main.ts"],"names":[],"mappings":"AAAA,cAAc,eAAe,CAAA;AAC7B,cAAc,eAAe,CAAA"}
```
## index.js

```js


```