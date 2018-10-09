'use strict';

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const debug = require('debug')('loader:loader');

const Module = require('./module');
const initByMime = require('./init');

const readFile = promisify(fs.readFile);

function createNodeCoreWrap(urlObject) {
  return {
    bytes: null,
    url: urlObject.toString(),
    contentType: 'text/vnd.node.js',
  };
}

function getMimeFromPath(pathname) {
  const ext = path.extname(pathname);
  switch (ext) {
    case '.mjs':
      return 'text/javascript';

    case '.wasm':
      return 'application/wasm';

    default:
      throw new Error(`Cannot determine mime-type for ${ext} in ${pathname}`);
  }
}

async function fetchResource(url) {
  // { bytes: Buffer, contentType: String }
  const urlObject = new URL(url);
  if (urlObject.protocol === 'node:') {
    return createNodeCoreWrap(urlObject);
  } else if (urlObject.protocol !== 'file:') {
    throw new TypeError(
      `Only file: protocol is supported, got ${urlObject} in ${url}`
    );
  }
  const sourceText = await readFile(urlObject);
  return {
    bytes: sourceText,
    url,
    contentType: getMimeFromPath(urlObject.pathname),
  };
}

class ResolveModuleJob {
  constructor(sourceTexts, loader, moduleMap) {
    this._sourceTexts = sourceTexts;
    this._moduleMap = moduleMap;
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

  async initialize(url, wrap) {
    debug('initialize', url);
    const sourceText = await this._sourceTexts.get(url);
    initByMime(wrap, sourceText, Module);

    for (const specifier of wrap.requests) {
      if (wrap.isResolved(specifier)) continue;

      const depURL = this._loader.resolveSpecifier(specifier, url);
      const dep = this._moduleMap.getRaw(depURL);
      debug('resolveRequest %s --[%s]--> %s', url, specifier, depURL);
      wrap.resolveRequest(specifier, dep);

      this.push(depURL, dep);
    }

    return wrap;
  }

  async run(url, wrap) {
    this.push(url, wrap);
    await this.done;

    for (const depWrap of this._byURL.values()) {
      depWrap.instantiate();
    }
  }
}

class ModuleMap {
  constructor(loader, sourceTexts) {
    this._loader = loader;
    this._sourceTexts = sourceTexts;
    this._cache = new Map();
  }

  getRaw(url) {
    if (this._cache.has(url)) return this._cache.get(url);

    const wrap = new Module(url);
    this._cache.set(url, wrap);

    return wrap;
  }

  async get(url) {
    const wrap = this.getRaw(url);
    const job = new ResolveModuleJob(this._sourceTexts, this._loader, this);

    await job.run(url, wrap);

    const evalResult = wrap.evaluate();
    debug('eval %j', url, evalResult);

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
    this._packageMap = new Map();
    this._moduleMap = new ModuleMap(this, {
      get: fetchResource,
    });
  }

  async importFromResolvedURL(url) {
    // 1. Get module map and insert URL
    // 1. Resolve sourceText
    return (await this._moduleMap.get(url)).namespace;
  }

  importFromSpecifier(specifier, referrerUrl) {
    const resolved = this.resolveSpecifier(specifier, referrerUrl);
    return this.importFromResolvedURL(resolved);
  }

  // TODO: Take into account any kind of package-map etc.
  // TODO: Should this be customizable per context..?
  resolveSpecifier(specifier, referrerUrl) {
    if (/^\.{0,2}\//.test(specifier)) {
      return new URL(specifier, referrerUrl).href;
    } else {
      const importURL = new URL(`import:${specifier}`);
      const rewritten = this._packageMap.get(importURL.href) || importURL.href;
      return rewritten;
    }
  }
}
module.exports = Loader;
