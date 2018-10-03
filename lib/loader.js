'use strict';

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const debug = require('debug')('loader');
const bindings = require('bindings');

const createDynamicModule = require('./create_dynamic_module');

const readFile = promisify(fs.readFile);

const {
  ModuleWrap,
  setDynamicImportCallback,
  setInitImportMetaCallback,
} = bindings('loader');

function initByMime(url, wrap, sourceText) {
  const { mimeType } = sourceText;

  switch (mimeType) {
    case 'text/javascript': {
      wrap.compile(sourceText.content.toString());
      break;
    }

    case 'text/vnd.node.js': {
      const urlObject = new URL(url);
      const actual = require(urlObject.pathname);
      const exportKeys = Object.keys(actual);
      createDynamicModule(
        ModuleWrap,
        wrap,
        [...exportKeys, 'default'],
        url,
        reflect => {
          debug(`Loading BuiltinModule ${url}`);
          wrap.reflect = reflect;
          for (const key of exportKeys) {
            reflect.exports[key].set(actual[key]);
          }
          reflect.exports.default.set(actual);
        }
      );
      break;
    }

    case 'application/wasm': {
      // super simplistic and just for demo purposes.
      // the way this is set up doesn't support dependencies etc.
      /* global WebAssembly */
      const instance = new WebAssembly.Instance(
        new WebAssembly.Module(sourceText)
      );
      const mirror = Object.keys(instance.exports)
        .map(exportKey => `export let ${exportKey};`)
        .join('\n');
      const inits = Object.keys(instance.exports)
        .map(exportKey => `${exportKey} = $_data_.${exportKey}`)
        .join('\n  ');
      const wrapSource = `\
${mirror}

(function initMirrors($_data_) {
  ${inits}
});`;
      wrap.compile(wrapSource);
      wrap.instantiate();
      const hole = wrap.evaluate();
      hole(instance.exports);
      break;
    }

    default:
      throw new TypeError(`Unsupported mime-type ${mimeType} for ${url}`);
  }
}

class ResolveModuleJob {
  constructor(sourceTexts, loader, moduleMap) {
    this._sourceTexts = sourceTexts;
    this._moduleMap = moduleMap;
    this._loader = loader;
    this._byURL = new Map();
    this._pending = 0;
    this.done = new Promise((resolve, reject) => {
      this._depDone = (depURL, wrap) => {
        this._byURL.set(depURL, wrap);
        --this._pending;
        if (this._pending === 0) resolve();
      };
      this._depFailed = reject;
    });
  }

  push(url, wrap) {
    if (this._byURL.has(url)) return;
    ++this._pending;
    this._byURL.set(url, false);
    const done = this.initialize(url, wrap);
    this._byURL.set(
      url,
      done.then(
        () => {
          this._depDone(url, wrap);
        },
        error => this._depFailed(error)
      )
    );
  }

  async initialize(url, wrap) {
    debug('initialize', url);
    const sourceText = await this._sourceTexts.get(url);
    initByMime(url, wrap, sourceText);

    for (const specifier of wrap.getRequests()) {
      if (wrap.isResolved(specifier)) continue;

      const depURL = this._loader.resolveSpecifier(specifier, url);
      const dep = this._moduleMap.getRaw(depURL);
      debug('resolveRequest %s --[%s]--> %s', url, specifier, depURL);
      wrap.resolveRequest(specifier, dep);

      this.push(depURL, dep);
    }

    return wrap;
  }

  async run(url, wrap) {
    this.push(url, wrap);
    await this.done;

    for (const depWrap of this._byURL.values()) {
      depWrap.instantiate();
    }
  }
}

class ModuleMap {
  constructor(loader, sourceTexts) {
    this._loader = loader;
    this._sourceTexts = sourceTexts;
    this._cache = new Map();
  }

  getRaw(url) {
    if (this._cache.has(url)) return this._cache.get(url);

    const wrap = new ModuleWrap(url);
    this._cache.set(url, wrap);

    return wrap;
  }

  async get(url) {
    const wrap = this.getRaw(url);
    const job = new ResolveModuleJob(this._sourceTexts, this._loader, this);

    await job.run(url, wrap);

    const evalResult = wrap.evaluate();
    debug('eval %j', url, evalResult);

    return wrap;
  }

  has(url) {
    return this._cache.has(url);
  }

  set(url, constructedModule) {
    // 1. Check that the URL hasn't been registered yet
    // 2. Set the URL to the provided module instance
    // 3. Done!
    this._cache.set(url, Object.assign(constructedModule, { ready: true }));
    return this;
  }
}

function createNodeCoreWrap(urlObject) {
  return {
    content: null,
    url: urlObject.toString(),
    mimeType: 'text/vnd.node.js',
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

class Loader {
  constructor() {
    this._defaultSourceTextProvider = new Map();
    this._packageMap = new Map();
    this._moduleMap = new ModuleMap(this, {
      async get(url) {
        // { content: Buffer, mimeType: String }
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
          content: sourceText,
          url,
          mimeType: getMimeFromPath(urlObject.pathname),
        };
      },
    });
  }

  async importFromResolvedURL(url) {
    // 1. Get module map and insert URL
    // 1. Resolve sourceText
    return (await this._moduleMap.get(url)).getNamespace();
  }

  importFromSpecifier(specifier, referrerUrl) {
    const resolved = this.resolveSpecifier(specifier, referrerUrl);
    return this.importFromResolvedURL(resolved);
  }

  // TODO: Take into account any kind of package-map etc.
  // TODO: Should this be customizable per context..?
  resolveSpecifier(specifier, referrerUrl) {
    if (/^\.{0,2}\//.test(specifier)) {
      return new URL(specifier, referrerUrl).href;
    } else {
      const importURL = new URL(`import:${specifier}`);
      const rewritten = this._packageMap.get(importURL.href) || importURL.href;
      return rewritten;
    }
  }
}

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
      const depPath = `${path.join(scopePath, 'node_modules', dep)}/`;
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
  const { builtinModules } = require('module');
  for (const builtin of builtinModules) {
    loader['_packageMap'].set(`import:${builtin}`, `node:${builtin}`);
  }
  return module.exports;
}
exports.registerUnprefixedNodeCoreModules = registerUnprefixedNodeCoreModules;

function ensureCreateRequireFromPath() {
  const Module = require('module');
  Module.createRequireFromPath = filename => {
    const m = new Module(filename);
    m.filename = filename;
    m.paths = Module._nodeModulePaths(path.dirname(filename));
    return m._compile('return require', filename);
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
