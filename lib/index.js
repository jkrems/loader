'use strict';

const path = require('path');
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

function addPackageJSONToMap(pkgJson) {
  const loader = getLoader();
  for (const dep of Object.keys(pkgJson.dependencies || {})) {
    loader['_packageMap'].set(
      `import:${dep}`,
      new URL(`file:${require.resolve(dep)}`).href
    );
  }
  for (const dep of Object.keys(pkgJson.devDependencies || {})) {
    loader['_packageMap'].set(
      `import:${dep}`,
      new URL(`file:${require.resolve(dep)}`).href
    );
  }
}
exports.addPackageJSONToMap = addPackageJSONToMap;

function addPackageLockToMap(pkgLock) {
  const loader = getLoader();
  function visit(entry, scopePath) {
    for (const [dep] of Object.entries(entry.dependencies || {})) {
      if (builtinModules.includes(dep)) continue;
      const depPath = `${path.join(scopePath, 'node_modules', dep)}/`;
      // eslint-disable-next-line import/no-dynamic-require
      const pkgJSON = require(path.join(depPath, 'package.json'));
      const main = pkgJSON.main || 'index.js';
      const mainURL = new URL(main, new URL(`file://${depPath}`)).href;
      loader['_packageMap'].set(`import:${dep}`, mainURL);
    }
  }
  visit(pkgLock, path.resolve());
}
exports.addPackageLockToMap = addPackageLockToMap;

function registerUnprefixedNodeCoreModules() {
  const loader = getLoader();
  for (const builtin of builtinModules) {
    loader['_packageMap'].set(`import:${builtin}`, `node:${builtin}`);
  }
  return module.exports;
}
exports.registerUnprefixedNodeCoreModules = registerUnprefixedNodeCoreModules;

function ensureCreateRequireFromPath() {
  const NodeModule = require('module');
  NodeModule.createRequireFromPath = filename => {
    const m = new NodeModule(filename);
    m.filename = filename;
    m.paths = NodeModule['_nodeModulePaths'](path.dirname(filename));
    return m['_compile']('return require', filename);
  };
  return module.exports;
}
exports.ensureCreateRequireFromPath = ensureCreateRequireFromPath;

function initImportMeta(wrap, meta) {
  meta.url = wrap.url;
}

function enableImportMeta() {
  setInitImportMetaCallback(initImportMeta);
  return module.exports;
}
exports.enableImportMeta = enableImportMeta;

async function resolveDynamicImport(specifier, referrer, hasOptions) {
  // Without options assume referrer is not a module URL but a file path
  const baseUrl = hasOptions ? referrer : new URL(`file://${referrer}`);
  // TODO: Retrieve loader for current context
  return getLoader().importFromSpecifier(specifier, baseUrl);
}

function enableDynamicImport() {
  setDynamicImportCallback(resolveDynamicImport);
  return module.exports;
}
exports.enableDynamicImport = enableDynamicImport;
