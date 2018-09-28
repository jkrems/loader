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
import('./esm.js')
  .then(ns => console.log(ns));
```

## Semantics

```js
import 'bare';
```

## Random Ideas

* Use `package-lock.json` to resolve bare specifiers.
