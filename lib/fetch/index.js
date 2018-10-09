'use strict';

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readFile = promisify(fs.readFile);

function createNodeCoreWrap() {
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
    contentType: getMimeFromPath(urlObject.pathname),
  };
}
module.exports = fetchResource;
