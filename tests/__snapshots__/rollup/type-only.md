## dep.d.ts

```ts
export type Dep = "dep";

```
## main.d.ts

```ts
export type { Dep } from "./dep.js";
export declare const main = "main";

```
## main.js

```js
const main = "main";

export { main };

```