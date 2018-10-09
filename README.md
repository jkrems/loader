# `loader`

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
const loader = require('@jkrems/loader');

// Overwrite dynamic import to use this loader.
loader.enableDynamicImport();

// Overwrite import.meta to use this loader.
loader.enableImportMeta();

// Add node-core: URL scheme
loader.registerNodeCoreURLScheme();

// Add cjs-bridge: URL scheme
loader.registerCJSBridgeScheme();

// Add node core modules to the module map
loader.registerUnprefixedNodeCoreModules();

// Load an entry point.
import('./module.mjs')
  .then(ns => console.log(ns));
```

### API

#### `new Module(url: string)`

##### `module.compile(source: string): void`

Compile the given `source` as a module.

##### `module.setLazyStaticExports(keys: string[], getValues: () => object): void`

##### `module.setDynamicExports(getExports: () => object): void`

*This is a potential future API.*

##### `module.evaluate(): any`

## Semantics

The system is split into 3 separate pieces:

1. Module resolution
1. Resource fetching
1. Module init

### Module Resolution (`resolve`)

Given a `specifier: string` and `referrerURL: string`,
provide a `url: string` or a set of potential `urls: string[]` of a resource:

```ts
const resolve: (specifier: string, referrerURL: string) => string | string[];
```

If the resolution fails (e.g. because of an invalid URL),
the function should throw.

### Resource Fetching (`fetch`)

Given a resource `url: string`,
fetch the resource content and associated meta data.

```ts
type Resource = {
  url: string,
  contentType: string,
  // Necessary..?
  contentTypeParameters?: string,
  bytes?: Buffer,
};

const fetch: (url: string) => Resource;
```

If fetching fails (e.g. because the resource cannot be found),
the function should throw.

### Module Init (`init`)

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
  that process is handed over to a `Job`.
  The `Job` keeps track of everything that needs to wrap up before the requested
  module can be returned and provides a `Promise` for its completion.
* During `Job` execution, the resolve, load and init hooks that have been
  registered will be called.

## Random Ideas

* Use `package-lock.json` to resolve bare specifiers.

## Links

* [`package-name-maps`](https://github.com/domenic/package-name-maps/blob/url-based/README.md#import-urls)
