'use strict';

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readFile = promisify(fs.readFile);

const DEFAULT_PROTOCOL_HANDLERS = new Map([
  ['node:', fetchNodeCoreResource],
  ['file:', fetchFromDisk],
]);

function fetchNodeCoreResource() {
  return {
    bytes: null,
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

async function fetchFromDisk(url) {
  const urlObject = new URL(url);
  const sourceText = await readFile(urlObject);
  return {
    bytes: sourceText,
    contentType: getMimeFromPath(urlObject.pathname),
  };
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
