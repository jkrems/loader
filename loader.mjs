import {pathToFileURL} from 'url';

import cs from 'coffeescript';

globalThis.self = globalThis;

const fetchHandlers = [];

globalThis.addEventListener = (eventName, handler) => {
  if (eventName === 'fetch') {
    fetchHandlers.push(handler);
  }
};

const UNKNOWN_EXTENSION_PATTERN = /^Unknown file extension "\.(?:[^"]*)" for (.+?) imported from /;
const MODULE_NOT_FOUND_PATTERN = /^Cannot find module (.+?) imported from /;

function parseResolvedUrl(err) {
  if (err.code === 'ERR_UNKNOWN_FILE_EXTENSION') {
    const m = err.message.match(UNKNOWN_EXTENSION_PATTERN);
    if (m) {
      return pathToFileURL(m[1]).href;
    }
  } else if (err.code === 'ERR_MODULE_NOT_FOUND') {
    const m = err.message.match(MODULE_NOT_FOUND_PATTERN);
    if (m) {
      return pathToFileURL(m[1]).href;
    }
  }
  throw err;
}

async function getURLFromDefaultResolver(specifier,
                                         parentModuleURL,
                                         defaultResolver) {
  try {
    return (await defaultResolver(specifier, parentModuleURL)).url;
  } catch (e) {
    return parseResolvedUrl(e);
  }
}

class FetchEvent {
  constructor(type, init) {
    this._type = type;
    this._init = init;
    this.responsePromise = null;
  }

  get request() {
    return this._init.request;
  }

  respondWith(responsePromise) {
    this.responsePromise = responsePromise;
  }
}

// TODO: Use full Headers API
class Headers {
  constructor(values = []) {
    this.values = new Map(values);
  }

  set(key, value) {
    this.values.set(key, value);
  }
}

// TODO: Use full Request API
class Request {
  constructor(url) {
    this.url = url;
    this.method = 'GET';
  }
}

// TODO: Use full Response API
class Response {
  constructor(body, init = {}) {
    this.url = null;
    this.body = body;
    this.status = init.status || 200;
    this.headers = new Map();
  }

  evilAddURL(url) {
    this.url = url;
    return this;
  }

  async text() {
    return this.body;
  }
}

async function fetch(request) {
  // TODO: Setting the URL shouldn't be exposed like this but *shrug*
  return new Response('console.log("TODO")').evilAddURL(request.url);
}

export async function resolve(specifier,
                              parentModuleURL,
                              defaultResolver) {
  const resolvedURL =
    await getURLFromDefaultResolver(specifier, parentModuleURL, defaultResolver);

  const request = new Request(resolvedURL);
  const event = new FetchEvent('fetch', { request });
  for (const handler of fetchHandlers) {
    handler(event);
  }
  const response = await event.responsePromise;
  console.log(response);
  return {
    url: resolvedURL,
    format: 'module',
  };
}

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

function isCoffeescript(res) {
  return isType(res, 'application/vnd.coffeescript', '.coffee');
}

self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).then(async res => {
      if (res.status !== 200 || !isCoffeescript(res)) {
        return res;
      }
      const coffeeSource = await res.text();
      const body = cs.compile(coffeeSource, { bare: true });
      const headers = new Headers(res.headers);
      // TODO: Determine if this is ESM or CJS
      headers.set('content-type', 'text/javascript');
      return new Response(body, { headers });
    })
  );
});
