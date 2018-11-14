'use strict';

const fs = require('fs');

// 1. locate: Turn specifier + referrer into Location
// 2. retrieve(location): Turn Location into Response

// 1. If `import:` - fail.
// 1. If starts with ./, ../ or /: return basic resolution.
//    Gotcha: Fail if referrer is not a URL.
//    Open question: Should a non-URL referrer be able to provide a referrer URL?
// 1. TODO: Intercept core modules here?
// 1. If bare specifier - invoke locate hooks. Default implementation:
//    1. Call find package boundary, returns package meta URL
//    1. Retrieve meta data
//    1. Resolve specifier using meta data

// From: https://github.com/npm/validate-npm-package-name/blob/master/index.js
const scopedPackagePattern = new RegExp('^((?:@([^/]+?)[/])?([^/]+?))(/.*)?$');

function normalizeLocation(location) {
  if (typeof location === 'symbol') return location;
  if (typeof location === 'string') return Symbol.for(location);
  throw new TypeError('Expected either a Symbol or a string');
}

/**
 * @param {string} specifier
 * @param {string} baseURL
 */
function locateFromImportMap(resources, specifier, baseURL) {
  // 1. Determine package name
  const pkgNameMatch = specifier.match(scopedPackagePattern);
  if (!pkgNameMatch) {
    throw new Error(`Could not extract package name from ${specifier}`);
  }
  const [, scopedName, scope, name, subpath] = pkgNameMatch;
  if (
    (scope !== undefined && scope !== encodeURIComponent(scope)) ||
    name !== encodeURIComponent(name)
  ) {
    throw new Error(
      `Can only use URL-safe characters in scope ${scope} and name ${name}`
    );
  }
  if (name[0] === '.' || name[0] === '_') {
    throw new Error(`name ${name} may not start with "." or "_"`);
  }

  // 2. Find package boundary based on base url
  const pkgMetaPath = `./node_modules/${scopedName}/package.json`;
  let baseDir = new URL('./', baseURL);
  do {
    const pkgMetaURL = new URL(pkgMetaPath, baseDir);
    let pkgMetaSource = null;
    try {
      pkgMetaSource = resources.loadSync(pkgMetaURL.href, baseURL);
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
    if (pkgMetaSource !== null) {
      // 3. Load exports map
      const pkgMeta = JSON.parse(pkgMetaSource.toString());
      // 4. Determine import map resolution of specifier
      // 5. Return!
      return new URL(`.${subpath}`, pkgMeta && pkgMetaURL).href;
    }
    baseDir = new URL('../', baseDir);
  } while (baseDir.pathname !== '/');

  throw new Error(`Could not resolve ${specifier} in the scope of ${baseURL}`);
}

/**
 * @param {string} specifier
 * @param {string} baseURL
 */
function locate(resources, specifier, baseURL) {
  // 1. Is specifier an import URL?
  if (specifier.startsWith('import:')) {
    specifier = specifier.slice('import:'.length);
    if (/^\.{0,2}\//.test(specifier)) {
      return new URL(specifier, baseURL.href);
    }
    try {
      return new URL(specifier).href;
    } catch (e) {
      /* ignored */
    }
    // It is a bare specifier via import URL!
    return locateFromImportMap(resources, specifier, baseURL);
  }
  return new URL(specifier, baseURL).href;
}

function retrieveSync(location) {
  const url = Symbol.keyFor(location);
  if (!url) {
    throw new Error('Cannot retrieve non-URL resource');
  }
  const parsed = new URL(url);
  if (parsed.protocol !== 'file:') {
    throw new Error(`Cannot load non-file URL ${url}`);
  }
  return fs.readFileSync(parsed);
}

class ResourceManager {
  locate(specifier, referrerURL) {
    return normalizeLocation(locate(this, specifier, referrerURL));
  }

  /**
   * @param {string} specifier
   * @param {string} referrerURL
   */
  load(specifier, referrerURL) {
    const location = this.locate(specifier, referrerURL);
    return location;
  }

  loadSync(specifier, referrerURL) {
    const location = this.locate(specifier, referrerURL);
    // TODO: Make this a proper Response with json() promise etc.
    return retrieveSync(location);
  }
}

new ResourceManager().load('import:lodash/map.js', `file://${__filename}`);
