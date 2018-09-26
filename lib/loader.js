'use strict';

const bindings = require('bindings');

const native = bindings('loader');

class ModuleMap {
  constructor() {
    this._cache = new Map();
  }

  get(url) {
    // 1. Lazily insert into internal map
    // 2. Ensure the module is evaluated
    return {
      getNamespace() {
        return { url };
      },
    };
  }

  has(url) {
    return this._cache.has(url);
  }

  set(url, constructedModule) {
    // 1. Check that the URL hasn't been registered yet
    // 2. Set the URL to the provided module instance
    // 3. Done!
    this._cache.set(url, constructedModule);
    return this;
  }
}

class Loader {
  constructor() {
    this._moduleMap = new ModuleMap();
  }

  importFromResolvedURL(url) {
    // 1. Get module map and insert URL
    // 1. Resolve sourceText
    return this._moduleMap.get(url).getNamespace();
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
