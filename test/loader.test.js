'use strict';

const assert = require('assertive');

const { Loader } = require('../');

describe('Loader', () => {
  describe('with simple mocked logic', () => {
    it('can load and link some modules', async () => {
      const localLoader = new Loader();
      const entryCode = Buffer.from(`\
import x from './x';
import * as y from './y';

export const combined = [x, y.default].join(' ');
`);
      localLoader.fetch = url => {
        return {
          url,
          bytes:
            url === 'file:///a'
              ? entryCode
              : Buffer.from(`export default ${JSON.stringify(url)}`),
          contentType: 'application/javascript',
        };
      };
      localLoader.init = (target, resource) => {
        assert.equal('application/javascript', resource.contentType);
        target.compile(resource.bytes.toString());
      };
      const a = await localLoader.importFromResolvedURL('file:///a');
      assert.deepEqual(
        { combined: 'file:///x file:///y' },
        Object.assign({}, a)
      );
    });
  });
});
