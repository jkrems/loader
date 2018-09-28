'use strict';

const fs = require('fs');
const { promisify } = require('util');

const debug = require('debug')('loader');
const bindings = require('bindings');

const readFile = promisify(fs.readFile);

const { ModuleWrap, SetDynamicImportCallback } = bindings('loader');

class ResolveModuleJob {
  constructor(sourceTexts, loader, moduleMap) {
    this._sourceTexts = sourceTexts;
    this._moduleMap = moduleMap;
    this._loader = loader;
    this._byURL = new Map();
    this._pending = 0;
    this.done = new Promise((resolve, reject) => {
      this._depDone = depURL => {
        this._byURL.set(depURL, true);
        --this._pending;
        if (this._pending === 0) resolve();
      };
      this._depFailed = reject;
    });
  }

  async initialize(url, wrap) {
    debug('initialize', url);
    const sourceText = await this._sourceTexts.get(url);
    wrap.compile(sourceText);

    for (const specifier of wrap.getRequests()) {
      const depURL = this._loader.resolveSpecifier(specifier, url);
      const dep = this._moduleMap.getRaw(depURL);
      debug('resolveRequest %s --[%s]--> %s', url, specifier, depURL);
      wrap.resolveRequest(specifier, dep);

      if (this._byURL.has(depURL)) continue;
      ++this._pending;
      this._byURL.set(depURL, false);
      const depDone = this.initialize(depURL, dep);
      this._byURL.set(
        depURL,
        depDone.then(
          () => {
            this._depDone(depURL);
          },
          error => this._depFailed(error)
        )
      );
    }

    return wrap;
  }

  async run(url, wrap) {
    ++this._pending;
    this._byURL.set(url, false);
    await this.initialize(url, wrap);
    this._depDone(url);
    await this.done;
  }
}

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

  async get(url) {
    const wrap = this.getRaw(url);
    const job = new ResolveModuleJob(this._sourceTexts, this._loader, this);

    await job.run(url, wrap);

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
