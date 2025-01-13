## foo/index.d.ts

```ts
export type Foo = string;

```
## index.d.ts

```ts
export type Bar = string;

```
## main.d.ts

```ts
export {} from './foo/index.js';
export {} from './index.js';
export {} from './index.js';

```
## main.js

```js


```