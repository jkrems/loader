'use strict';

const { parentPort } = require('worker_threads');

const cs = require('coffeescript');
const ts = require('typescript');

const RESOURCES = new Map([
  [
    'https://example.com/bin.js',
    {
      contentType: 'text/javascript',
      body: `\
import foo from './foo.coffee';

console.log('running bin', { foo }, import.meta);

import('./foo.ts').then(ts => {
  console.log('after import()', { ts });
});
`,
    },
  ],
  [
    'https://example.com/foo.coffee',
    {
      contentType: 'application/vnd.coffeescript',
      body: `\
export default "coffee-style #{42}"

console.log 'running foo.coffee'
`,
    },
  ],
  [
    'https://example.com/foo.ts',
    {
      contentType: 'application/vnd.typescript',
      body: `\
enum Foo { A, B }
export default Foo;

console.log('running foo.ts', import.meta);
`,
    },
  ],
]);

/**
 * @param {string} urlString
 * @param {string} fileExtension
 */
function isFileExtensionURL(urlString, fileExtension) {
  const url = new URL(urlString);
  return url.protocol === 'file:' && url.pathname.endsWith(fileExtension);
}

/**
 * @param {Response} res
 * @param {string} mimeType
 * @param {string} fileExtension
 */
function isType(res, mimeType, fileExtension) {
  const contentType = (res.headers.get('content-type') || '').toLocaleLowerCase(
    'en'
  );
  if (contentType === mimeType) {
    return true;
  }
  return !contentType && isFileExtensionURL(res.url, fileExtension);
}

function isCoffeeScript(res) {
  return isType(res, 'application/vnd.coffeescript', '.coffee');
}

function isTypeScript(res) {
  return isType(res, 'application/vnd.typescript', '.ts');
}

const TRANSFORMS = [
  response => {
    if (!isCoffeeScript(response)) return response;
    return {
      url: response.url,
      headers: new Map([['content-type', 'text/javascript']]),
      text: cs.compile(response.text),
    };
  },
  response => {
    if (!isTypeScript(response)) return response;
    return {
      url: response.url,
      headers: new Map([['content-type', 'text/javascript']]),
      text: ts.transpileModule(response.text, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
        },
      }).outputText,
    };
  },
];

class ResourceWorker {
  constructor(port) {
    this.port = port;
    port.on('message', this._handleMessage.bind(this));
  }

  async resolveImportURL(specifier, referrerURL) {
    return new URL(specifier, referrerURL).href;
  }

  async fetchResource(request) {
    const { contentType, body } = RESOURCES.get(request.url);
    let response = {
      url: request.url,
      headers: new Map([['content-type', contentType]]),
      text: body,
    };

    for (const transform of TRANSFORMS) {
      response = transform(response);
    }

    return response;
  }

  async _handleMessage(message) {
    try {
      const result = await this[message.method](...message.args);
      this.port.postMessage({ id: message.id, result });
    } catch (error) {
      this.port.postMessage({ id: message.id, error });
    }
  }
}

console.log('booting resource worker');
new ResourceWorker(parentPort);
