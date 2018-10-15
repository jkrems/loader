'use strict';

const { builtinModules } = require('module');

const bindings = require('bindings');

const Loader = require('./loader');

const { setDynamicImportCallback, setInitImportMetaCallback } = bindings(
  'loader'
);

// TODO: Get loader for active context
const defaultLoader = new Loader();
function getLoader() {
  return defaultLoader;
}

exports.import = function importFromAbsoluteURL(url) {
  return getLoader().importFromResolvedURL(url);
};

function registerUnprefixedNodeCoreModules() {
  const loader = getLoader();
  const originalResolve = loader.resolve;
  function resolveWithCore(specifier, referrerURL) {
    if (builtinModules.includes(specifier)) {
      return `node:${specifier}`;
    }
    return originalResolve(specifier, referrerURL);
  }
  loader.resolve = resolveWithCore;
  return module.exports;
}
exports.registerUnprefixedNodeCoreModules = registerUnprefixedNodeCoreModules;

function initImportMeta(wrap, meta) {
  meta.url = wrap.url;
}

function enableImportMeta() {
  setInitImportMetaCallback(initImportMeta);
  return module.exports;
}
exports.enableImportMeta = enableImportMeta;

async function resolveDynamicImport(specifier, referrer) {
  const isFakeURL = referrer && referrer[0] === '/';
  // Without options assume referrer is not a module URL but a file path
  const baseUrl = isFakeURL ? new URL(`file://${referrer}`) : referrer;
  // TODO: Retrieve loader for current context
  return getLoader().importFromSpecifier(specifier, baseUrl);
}

function enableDynamicImport() {
  setDynamicImportCallback(resolveDynamicImport);
  return module.exports;
}
exports.enableDynamicImport = enableDynamicImport;

exports.Loader = Loader;
