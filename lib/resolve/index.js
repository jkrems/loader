'use strict';

function coreResolve(specifier, referrerUrl) {
  if (/^\.{0,2}\//.test(specifier)) {
    return new URL(specifier, referrerUrl).href;
  }
  return new URL(specifier).href;
}
module.exports = coreResolve;
