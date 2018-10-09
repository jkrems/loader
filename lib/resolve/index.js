'use strict';

function createResolveWithPackageNameMap() {
  const packageMap = new Map();

  function resolveWithPackageNameMap(specifier, referrerUrl) {
    if (/^\.{0,2}\//.test(specifier)) {
      return new URL(specifier, referrerUrl).href;
    } else {
      const importURL = new URL(`import:${specifier}`);
      const rewritten = packageMap.get(importURL.href) || importURL.href;
      return rewritten;
    }
  }

  resolveWithPackageNameMap.addMapping = function addMapping(original, target) {
    packageMap.set(original, target);
  };

  return resolveWithPackageNameMap;
}
module.exports = createResolveWithPackageNameMap;
