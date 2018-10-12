'use strict';

function coreResolve(specifier, referrerUrl) {
  if (/^\.{0,2}\//.test(specifier)) {
    return new URL(specifier, referrerUrl).href;
  }
  return new URL(specifier);
}
module.exports = coreResolve;
