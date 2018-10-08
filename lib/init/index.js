'use strict';

const initNodeJS = require('./node-js');
const initWASM = require('./wasm');

function initByMime(target, resource, Module) {
  const { contentType } = resource;

  switch (contentType) {
    case 'text/javascript':
      target.compile(resource.bytes.toString());
      break;

    case 'text/vnd.node.js':
      initNodeJS(target);
      break;

    case 'application/wasm':
      initWASM(target, resource, Module);
      break;

    default:
      throw new TypeError(
        `Unsupported mime-type ${contentType} for ${target.url}`
      );
  }
}
module.exports = initByMime;
