# `loader`

Design constraints, in order of importance:

1. Independent of node core's implementation.
1. Spec compliant.
1. Maximum browser compat.
1. Easy to use in existing applications.
1. Compatible with ecosystem code already written using ESM.
1. Minimal C++ to allow for fast iteration.

## Usage

```js
const Loader = require('@jkrems/loader');

const loader = new Loader();

// Overwrite dynamic import to use this loader.
loader.setDynamicImportCallback();

// Add node core URL scheme
loader.registerNodeCoreURLScheme();

// Add node core modules to the module map
loader.registerUnprefixedNodeCoreModules();

// Load an entry point.
loader
  .import(`file://${require.resolve('./esm.js')}`)
  .then(ns => console.log(ns));
```

## Semantics

## Random Ideas

* Use `package-lock.json` to resolve bare specifiers.
