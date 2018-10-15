# `hackable-loader`

**This is an experiment. Nobody should run this in production.**

Design constraints, in order of importance:

1. Independent of node core's implementation.
1. Spec compliant.
1. Maximum browser compat.
1. Easy to use in existing applications.
1. Compatible with ecosystem code already written using ESM.
1. Minimal C++ to allow for fast iteration.

### Progress

- [x] Resolve relative URLs.
- [x] Load cyclic modules.
- [x] `import.meta.url` in modules.
- [x] Dynamic `import()`.
- [ ] Try how much code would work with something like this.
- [ ] Define semantics for bare specifiers.
- [ ] Define "mime type" guards.
- [ ] Define node core interop.
- [ ] Define userland CJS interop.

## Usage

```js
const loader = require('hackable-loader');

loader
  // Overwrite dynamic import to use this loader.
  .enableDynamicImport();
  // Overwrite import.meta to use this loader.
  .enableImportMeta();
  // Add support for resolving 'fs' etc.
  .registerUnprefixedNodeCoreModules();

// Load an entry point.
import('./module.mjs')
  .then(ns => console.log(ns));
```

### API

#### `enableDynamicImport`

Configure `import()` of the active `v8::Isolate` to use this loader.

#### `enableImportMeta`

Configure `import.meta` of the active `v8::Isolate` to use this loader.

#### `registerUnprefixedNodeCoreModules(loader = getLoader)`

Add resolution of node's built-in modules like `'fs'`.
Otherwise they have to be imported using the `node:` URL scheme:

```js
// Without registerUnprefixedNodeCoreModules:
import { readFile } from 'node:fs';

// With:
import { readFile } from 'fs';
```

#### `new Module(url: string)`

The `Module` class is the JavaScript representation of a `v8::Module`.

##### `module.compile(source: string): void`

Compile the given `source` as a module.

##### `module.setLazyStaticExports(keys: string[], getValues: () => object): void`

##### `module.setDynamicExports(getExports: () => object): void`

*This is a potential future API.*

##### `module.evaluate(): any`

## Semantics

### `node:` URL Scheme

This scheme is used to address resources that aren't on disk
but are compiled into the node binary: The built-in modules like "fs".

**Example:** `node:fs`

### `contentType: 'text/vnd.node.js'`

Marks a resource that should be loaded as a node-style CommonJS module.
The "content" of this resource is ignored by the loader itself,
instead it will execute using the existing CommonJS module system.

If the `contentType` has `sideEffects=false` in its parameters,
we assume that we can run the module ahead of time to get its exports.

### Module Loading

Module loading is split into three phases:

1. Module resolution
1. Resource fetching
1. Module init

#### Module Resolution (`resolve`)

Given a `specifier: string` and `referrerURL: string`,
provide a `url: string` or a set of potential `urls: string[]` of a resource:

```ts
const resolve: (specifier: string, referrerURL: string) => string | string[];
```

If the resolution fails (e.g. because of an invalid URL),
the function should throw.

#### Resource Fetching (`fetch`)

Given a resource `url: string`,
fetch the resource content and associated meta data.

```ts
type Resource = {
  bytes?: Buffer,
  contentType: string,
  contentTypeParameters?: string,
};

const fetch: (url: string) => Resource;
```

If fetching fails (e.g. because the resource cannot be found),
the function should throw.

#### Module Init (`init`)

Given a `resource: Resource` and a `target: Module` module handle,
initialize the `target`.
Most implementations will check the `resource.contentType`
to select the appropriate behavior.

```ts
const init: (target: Module, resource: Resource, Module) => void;
```

If initialization fails (e.g. because the resource content fails to compile),
the function should throw.

## Internals

* One `Loader` instance per context / global.
* By default the `Loader` for a context starts out empty.
* Each `Loader` keeps a map of URL string to `Module`.
* When a URL is requested that hasn't been loaded already,
  that process is handed over to a `LoadModuleJob`.
  The `LoadModuleJob` keeps track of everything that needs to wrap up
  before the requested module can be returned
  and provides a `Promise` for its completion.
* During `LoadModuleJob` execution, the `resolve`, `fetch` and `init` hooks
  of the `Loader` will be called.

### `reflect:` URL Scheme

An interface that allows to manipulate the dynamic exports of a module.
It is used to expose non-ESM modules inside of ESM modules.

#### Examples

* `reflect:node:fs`: The module that is used to set up the exports of node's
  built-in `fs` module.

## Random Ideas

* Use `package-lock.json` to resolve bare specifiers.

## Links

* [`package-name-maps`](https://github.com/domenic/package-name-maps/blob/url-based/README.md#import-urls)
