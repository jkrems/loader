'use strict';

const fs = require('fs');
const { promisify } = require('util');

const readFile = promisify(fs.readFile);

const bindings = require('bindings');

const { ModuleWrap, SetDynamicImportCallback } = bindings('loader');

class ModuleMap {
  constructor(loader, sourceTexts) {
    this._loader = loader;
    this._sourceTexts = sourceTexts;
    this._cache = new Map();
  }

  getRaw(url) {
    const wrap = new ModuleWrap(url);
    wrap.ready = false;
    this._cache.set(url, wrap);

    return wrap;
  }

  async initialize(url, wrap) {
    const sourceText = await this._sourceTexts.get(url);
    wrap.compile(sourceText);

    const requests = wrap.getRequests().map(specifier => {
      const depURL = this._loader.resolveSpecifier(specifier, url);
      const dep = this.getRaw(depURL);
      wrap.resolveRequest(specifier, dep);
      return this.initialize(depURL, dep);
    });
    await Promise.all(requests);

    return wrap;
  }

  async get(url) {
    // 1. Lazily insert into internal map
    const wrap = this.getRaw(url);

    await this.initialize(url, wrap);

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
    this._cache.set(url, Object.assign(constructedModule, { ready: true }));
    return this;
  }
}

class Loader {
  constructor() {
    this._defaultSourceTextProvider = new Map();
    this._moduleMap = new ModuleMap(this, {
      async get(url) {
        const fileURL = new URL(url);
        if (fileURL.protocol !== 'file:') {
          throw new TypeError(
            `Only file: protocol is supported, got ${fileURL}`
          );
        }
        const sourceText = await readFile(fileURL, 'utf8');
        return sourceText;
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
