'use strict';

const { builtinModules } = require('module');

function registerUnprefixedNodeCoreModules(loader) {
  const originalResolve = loader.resolve;
  function resolveWithCore(specifier, referrerURL) {
    if (builtinModules.includes(specifier)) {
      return `node:${specifier}`;
    }
    return originalResolve(specifier, referrerURL);
  }
  loader.resolve = resolveWithCore;
  return loader;
}
module.exports = registerUnprefixedNodeCoreModules;
