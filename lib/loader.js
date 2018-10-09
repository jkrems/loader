'use strict';

const debug = require('debug')('loader:loader');

const fetchResource = require('./fetch');
const initByMime = require('./init');
const Module = require('./module');
const coreResolve = require('./resolve');

class LoadModuleJob {
  constructor(loader, moduleMap) {
    this._cache = moduleMap;
    this._loader = loader;
    this._byURL = new Map();
    this._pending = 0;
    this.done = new Promise((resolve, reject) => {
      this._depDone = (depURL, wrap) => {
        this._byURL.set(depURL, wrap);
        --this._pending;
        if (this._pending === 0) resolve();
      };
      this._depFailed = reject;
    });
  }

  push(url, wrap) {
    if (this._byURL.has(url)) return;
    ++this._pending;
    this._byURL.set(url, false);
    const done = this.initialize(url, wrap);
    this._byURL.set(
      url,
      done.then(
        () => {
          this._depDone(url, wrap);
        },
        error => this._depFailed(error)
      )
    );
  }

  getRawModuleHandle(url) {
    if (this._cache.has(url)) return this._cache.get(url);

    const handle = new Module(url);
    this._cache.set(url, handle);

    return handle;
  }

  async initialize(url, target) {
    debug('initialize', url);
    const resource = await (0, this._loader.fetch)(url);
    (0, this._loader.init)(target, resource, Module);

    for (const specifier of target.requests) {
      if (target.isResolved(specifier)) continue;

      const depURL = (0, this._loader.resolve)(specifier, url);
      const dep = this.getRawModuleHandle(depURL);
      debug('resolveRequest %s --[%s]--> %s', url, specifier, depURL);
      target.resolveRequest(specifier, dep);

      this.push(depURL, dep);
    }

    return target;
  }

  async run(url, target) {
    if (!target) {
      target = this.getRawModuleHandle(url);
    }
    this.push(url, target);
    await this.done;

    for (const depWrap of this._byURL.values()) {
      depWrap.instantiate();
    }

    const evalResult = target.evaluate();
    debug('eval %j', url, evalResult);

    return target;
  }
}

const MODULE_MAPS = new WeakMap();

async function loadModule(loader, url) {
  const moduleMap = MODULE_MAPS.get(loader);
  const existing = moduleMap.get(url);
  if (existing && existing.status >= Module.kEvaluated) {
    if (existing.status === Module.kErrored) {
      throw existing.exception;
    }
    return existing;
  }
  return new LoadModuleJob(loader, moduleMap).run(url, existing);
}

class Loader {
  constructor() {
    MODULE_MAPS.set(this, new Map());
    this.resolve = coreResolve.withPackageNameMap();
    this.fetch = fetchResource;
    this.init = initByMime;
  }

  async importFromResolvedURL(url) {
    // 1. Get module map and insert URL
    // 1. Resolve sourceText
    return (await loadModule(this, url)).namespace;
  }

  importFromSpecifier(specifier, referrerUrl) {
    const resolved = (0, this.resolve)(specifier, referrerUrl);
    return this.importFromResolvedURL(resolved);
  }
}
module.exports = Loader;
