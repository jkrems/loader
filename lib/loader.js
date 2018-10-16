'use strict';

const bindings = require('bindings');

const fetchResource = require('./fetch');
const initByMime = require('./init');
const coreResolve = require('./resolve');

const loadModule = require('./load');

const { setDynamicImportCallback, setInitImportMetaCallback } = bindings(
  'loader'
);

/**
 * @type {WeakMap<Loader, Map<string, Module>>}
 */
const MODULE_MAPS = new WeakMap();

let defaultLoader;

class Loader {
  constructor() {
    MODULE_MAPS.set(this, new Map());
    this.resolve = coreResolve;
    this.fetch = fetchResource;
    this.init = initByMime;
  }

  async import(url) {
    const moduleMap = MODULE_MAPS.get(this);
    return (await loadModule(this, moduleMap, url)).namespace;
  }

  importFromSpecifier(specifier, referrerUrl) {
    if (typeof specifier !== 'string' || typeof referrerUrl !== 'string') {
      throw new TypeError('Both specifier and referrer have to be strings');
    }
    const resolved = (0, this.resolve)(specifier, referrerUrl);
    if (typeof resolved !== 'string') {
      throw new TypeError('Resolve returned non-string value');
    }
    return this.import(resolved);
  }

  static enableImportMeta() {
    setInitImportMetaCallback(initImportMeta);
    return Loader;
  }

  static enableDynamicImport() {
    setDynamicImportCallback(resolveDynamicImport);
    return Loader;
  }

  // TODO: Get loader for active context
  static get current() {
    return defaultLoader;
  }
}

async function resolveDynamicImport(specifier, referrer) {
  const isFakeURL = referrer && referrer[0] === '/';
  // Without options assume referrer is not a module URL but a file path
  const baseUrl = isFakeURL ? new URL(`file://${referrer}`).href : referrer;
  // TODO: Retrieve loader for current context
  return Loader.current.importFromSpecifier(specifier, baseUrl);
}

function initImportMeta(wrap, meta) {
  meta.url = wrap.url;
}

defaultLoader = new Loader();

module.exports = Loader;
