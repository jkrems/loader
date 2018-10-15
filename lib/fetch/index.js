'use strict';

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readFile = promisify(fs.readFile);

const DEFAULT_MIME_MAP = new Map([
  ['.mjs', 'text/javascript'],
  ['.wasm', 'application/wasm'],
]);

const DEFAULT_PROTOCOL_HANDLERS = new Map([
  ['node:', fetchNodeCoreResource],
  ['file:', createDiskFetch(DEFAULT_MIME_MAP)],
]);

function fetchNodeCoreResource() {
  return {
    bytes: null,
    contentType: 'text/vnd.node.js',
    contentTypeParameters: 'sideEffects=false',
  };
}

function getMimeFromPath(mimeMap, pathname) {
  const ext = path.extname(pathname);
  const mime = mimeMap.get(ext);
  if (!mime) {
    throw new Error(`Cannot determine mime-type for ${ext} in ${pathname}`);
  }
  return mime;
}

function createDiskFetch(mimeMap) {
  async function fetchFromDisk(url) {
    const urlObject = new URL(url);
    const sourceText = await readFile(urlObject);
    return {
      bytes: sourceText,
      contentType: getMimeFromPath(mimeMap, urlObject.pathname),
    };
  }
  return fetchFromDisk;
}

function createResourceFetch(protocolHandlers) {
  async function fetchResource(url) {
    // { bytes: Buffer, contentType: String }
    const urlObject = new URL(url);
    const handler = protocolHandlers.get(urlObject.protocol);
    if (typeof handler !== 'function') {
      throw new TypeError(
        `Unsupported protocol ${urlObject.protocol} in ${url}`
      );
    }

    return handler(url);
  }

  return fetchResource;
}

module.exports = createResourceFetch(DEFAULT_PROTOCOL_HANDLERS);
