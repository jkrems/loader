'use strict';

const initNodeJS = require('./node-js');
const initWASM = require('./wasm');

function initJavaScript(target, resource) {
  target.compile(resource.bytes.toString());
}

const DEFAULT_HANDLERS = new Map([
  ['text/javascript', initJavaScript],
  ['text/vnd.node.js', initNodeJS],
  ['application/wasm', initWASM],
]);

function createMimeInit(handlers) {
  function initByMime(target, resource, Module) {
    const { contentType } = resource;

    const handler = handlers.get(contentType);
    if (typeof handler !== 'function') {
      throw new TypeError(
        `Unsupported mime-type ${contentType} for ${target.url}`
      );
    }
    handler(target, resource, Module);
  }
  return initByMime;
}
module.exports = createMimeInit(DEFAULT_HANDLERS);
