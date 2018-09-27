'use strict';

const bindings = require('bindings');

const { ModuleWrap, SetDynamicImportCallback } = bindings('loader');

class ModuleMap {
  constructor(sourceTexts) {
    this._sourceTexts = sourceTexts;
    this._cache = new Map();
  }

  async get(url) {
    // 1. Lazily insert into internal map
    const wrap = new ModuleWrap(url);
    this._cache.set(url, wrap);

    // 2. Get source text & compile
    const sourceText = await this._sourceTexts.get(url);
    wrap.compile(sourceText);

    // 3. Ensure the module is evaluated
    wrap.evaluate();

    return wrap;
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
    this._defaultSourceTextProvider = new Map();
    this._moduleMap = new ModuleMap({
      get(url) {
        return `\
console.log("ok", ${JSON.stringify(url)});

export const x = 42;
`;
      },
    });
  }

  async importFromResolvedURL(url) {
    // 1. Get module map and insert URL
    // 1. Resolve sourceText
    return (await this._moduleMap.get(url)).getNamespace();
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
  SetDynamicImportCallback(resolveDynamicImport);
}
exports.enableDynamicImport = enableDynamicImport;
