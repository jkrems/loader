'use strict';

const bindings = require('bindings');

const native = bindings('loader');

function importFromResolvedURL(url) {
  return { url };
}
exports.importFromResolvedURL = importFromResolvedURL;

function resolveSpecifier(specifier, referrerUrl) {
  return new URL(specifier, referrerUrl).href;
}

function importFromSpecifier(specifier, referrerUrl) {
  const resolved = resolveSpecifier(specifier, referrerUrl);
  return importFromResolvedURL(resolved);
}

async function resolveDynamicImport(specifier, referrer, hasOptions) {
  // Without options assume referrer is not a module URL but a file path
  const baseUrl = hasOptions ? referrer : new URL(`file://${referrer}`);
  return importFromSpecifier(specifier, baseUrl);
}

function enableDynamicImport() {
  native.SetDynamicImportCallback(resolveDynamicImport);
}
exports.enableDynamicImport = enableDynamicImport;
