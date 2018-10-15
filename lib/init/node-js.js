'use strict';

const { fileURLToPath } = require('url');

function initNodeJS(target, resource) {
  const isPure = resource.contentTypeParameters === 'sideEffects=false';
  const urlObject = new URL(target.url);
  let pathname;
  if (urlObject.protocol === 'file:') {
    pathname = fileURLToPath(urlObject);
  } else {
    pathname = urlObject.pathname;
  }

  if (isPure) {
    // eslint-disable-next-line import/no-dynamic-require
    const actual = require(pathname);
    const exportKeys = [...Object.keys(actual), 'default'];
    target.setLazyStaticExports(exportKeys, () => {
      return Object.assign({}, actual, {
        default: actual,
      });
    });
  } else {
    target.setLazyStaticExports(['default'], () => {
      // eslint-disable-next-line import/no-dynamic-require
      const actual = require(pathname);
      return { default: actual };
    });
  }
}
module.exports = initNodeJS;
