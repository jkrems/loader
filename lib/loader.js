'use strict';

const bindings = require('bindings');

const native = bindings('loader');

class Loader {
  importFromResolvedURL(url) {
    // 1. Resolve sourceText
    // 2. Get module map
    return { url };
  }

  importFromSpecifier(specifier, referrerUrl) {
    const resolved = this.resolveSpecifier(specifier, referrerUrl);
    return this.importFromResolvedURL(resolved);
  }

  // TODO: Take into account any kind of package-map etc.
  // TODO: Should this be customizable per context..?
  resolveSpecifier(specifier, referrerUrl) {
    return new URL(specifier, referrerUrl).href;
  }
}

// TODO: Get loader for active context
const defaultLoader = new Loader();
function getLoader() {
  return defaultLoader;
}

async function resolveDynamicImport(specifier, referrer, hasOptions) {
  // Without options assume referrer is not a module URL but a file path
  const baseUrl = hasOptions ? referrer : new URL(`file://${referrer}`);
  // TODO: Retrieve loader for current context
  return getLoader().importFromSpecifier(specifier, baseUrl);
}

function enableDynamicImport() {
  native.SetDynamicImportCallback(resolveDynamicImport);
}
exports.enableDynamicImport = enableDynamicImport;
