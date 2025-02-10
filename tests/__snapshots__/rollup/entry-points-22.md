## a/ComponentA/ComponentA/index.d.ts

```ts
import React from 'react';
export { a } from '../../Models/model/index.js';
interface ComponentAProps {
    test: string;
}
export declare function ComponentA(props: ComponentAProps): React.JSX.Element;
//# sourceMappingURL=index.d.ts.map
```
## a/ComponentA/ComponentA/index.d.ts.map

```map
{"version":3,"file":"index.d.ts","sourceRoot":"","sources":["../../../../../../fixtures/entry-points-22/a/ComponentA/ComponentA.tsx"],"names":[],"mappings":"AAAA,OAAO,KAAK,MAAM,OAAO,CAAA;AACzB,OAAO,EAAE,CAAC,EAAE,MAAM,iBAAiB,CAAA;AAEnC,UAAU,eAAe;IACvB,IAAI,EAAE,MAAM,CAAA;CACb;AAED,wBAAgB,UAAU,CAAC,KAAK,EAAE,eAAe,GAAG,KAAK,CAAC,GAAG,CAAC,OAAO,CAGpE"}
```
## a/ComponentA/ComponentA/index.js

```js
import 'react';
import { jsxs, Fragment } from 'react/jsx-runtime';

function ComponentA(props) {
	const { test } = props;
	return jsxs(Fragment, { children: ["ComponentA: ", test] });
}

export { ComponentA };

```
## a/Models/model/index.d.ts

```ts
export interface MyModel {
    some: string;
}
export declare const a = "b";
//# sourceMappingURL=index.d.ts.map
```
## a/Models/model/index.d.ts.map

```map
{"version":3,"file":"index.d.ts","sourceRoot":"","sources":["../../../../../../fixtures/entry-points-22/a/Models/model.ts"],"names":[],"mappings":"AAAA,MAAM,WAAW,OAAO;IACtB,IAAI,EAAE,MAAM,CAAA;CACb;AACD,eAAO,MAAM,CAAC,MAAM,CAAA"}
```
## a/index.d.ts

```ts
export { ComponentA } from "./ComponentA/ComponentA/index.js";
//# sourceMappingURL=index.d.ts.map
```
## a/index.d.ts.map

```map
{"version":3,"file":"index.d.ts","sourceRoot":"","sources":["../../../../fixtures/entry-points-22/a/index.ts"],"names":[],"mappings":"AAAA,OAAO,EAAE,UAAU,EAAE,MAAM,yBAAyB,CAAC"}
```
## a/index.js

```js
export { ComponentA } from './ComponentA/ComponentA/index.js';

```
## b/ComponentB/ComponentB/index.d.ts

```ts
import React from "react";
interface ComponentBProps {
    test: string;
}
export declare function ComponentB(props: ComponentBProps): React.JSX.Element;
export {};
//# sourceMappingURL=index.d.ts.map
```
## b/ComponentB/ComponentB/index.d.ts.map

```map
{"version":3,"file":"index.d.ts","sourceRoot":"","sources":["../../../../../../fixtures/entry-points-22/b/ComponentB/ComponentB.tsx"],"names":[],"mappings":"AAAA,OAAO,KAAK,MAAM,OAAO,CAAC;AAE1B,UAAU,eAAe;IACvB,IAAI,EAAE,MAAM,CAAC;CACd;AAED,wBAAgB,UAAU,CAAC,KAAK,EAAE,eAAe,GAAG,KAAK,CAAC,GAAG,CAAC,OAAO,CAGpE"}
```
## b/ComponentB/ComponentB/index.js

```js
import 'react';
import { jsxs, Fragment } from 'react/jsx-runtime';

function ComponentB(props) {
	const { test } = props;
	return jsxs(Fragment, { children: ["ComponentB: ", test] });
}

export { ComponentB };

```
## b/index.d.ts

```ts
export { ComponentB } from "./ComponentB/ComponentB/index.js";
//# sourceMappingURL=index.d.ts.map
```
## b/index.d.ts.map

```map
{"version":3,"file":"index.d.ts","sourceRoot":"","sources":["../../../../fixtures/entry-points-22/b/index.ts"],"names":[],"mappings":"AAAA,OAAO,EAAE,UAAU,EAAE,MAAM,yBAAyB,CAAC"}
```
## b/index.js

```js
export { ComponentB } from './ComponentB/ComponentB/index.js';

```