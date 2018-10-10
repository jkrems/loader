'use strict';

function initNodeJS(target) {
  const urlObject = new URL(target.url);
  if (urlObject.protocol === 'node:') {
    // eslint-disable-next-line import/no-dynamic-require
    const actual = require(urlObject.pathname);
    const exportKeys = [...Object.keys(actual), 'default'];
    target.setLazyStaticExports(exportKeys, () => {
      return Object.assign({}, actual, {
        default: actual,
      });
    });
  } else {
    target.setLazyStaticExports(['default'], () => {
      // eslint-disable-next-line import/no-dynamic-require
      const actual = require(urlObject.pathname);
      return { default: actual };
    });
  }
}
module.exports = initNodeJS;
