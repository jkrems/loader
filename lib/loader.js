'use strict';

const bindings = require('bindings');

const native = bindings('loader');

function importFromURL(url) {
  return { url };
}
exports.importFromURL = importFromURL;

async function resolveDynamicImport(specifier, referrer, hasOptions) {
  // Without options assume referrer is not a module URL but a file path
  const baseUrl = hasOptions ? referrer : new URL(`file://${referrer}`);
  const resolved = new URL(specifier, baseUrl);
  return importFromURL(resolved);
}

function enableDynamicImport() {
  native.SetDynamicImportCallback(resolveDynamicImport);
}
exports.enableDynamicImport = enableDynamicImport;
