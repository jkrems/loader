'use strict';

function createResolveWithPackageNameMap() {
  const packageMap = new Map();

  function resolveWithPackageNameMap(specifier, referrerUrl) {
    if (/^\.{0,2}\//.test(specifier)) {
      return new URL(specifier, referrerUrl).href;
    } else {
      const importURL = new URL(`import:${specifier}`);
      const rewritten = packageMap.get(importURL.href) || specifier;
      return new URL(rewritten).href;
    }
  }

  resolveWithPackageNameMap.addMapping = function addMapping(original, target) {
    packageMap.set(original, target);
  };

  return resolveWithPackageNameMap;
}

function coreResolve(specifier, referrerUrl) {
  if (/^\.{0,2}\//.test(specifier)) {
    return new URL(specifier, referrerUrl).href;
  }
  return new URL(specifier);
}
module.exports = coreResolve;

coreResolve.withPackageNameMap = createResolveWithPackageNameMap;
