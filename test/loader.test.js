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
          bytes:
            url === 'file:///a'
              ? entryCode
              : Buffer.from(`export default ${JSON.stringify(url)}`),
          contentType: 'text/javascript',
        };
      };
      localLoader.init = (target, resource) => {
        assert.equal('text/javascript', resource.contentType);
        target.compile(resource.bytes.toString());
      };
      const a = await localLoader.importFromResolvedURL('file:///a');
      assert.deepEqual(
        { combined: 'file:///x file:///y' },
        Object.assign({}, a)
      );
    });

    it('re-throws if loading the same failing module twice', async () => {
      const l = new Loader();
      l.fetch = () => ({
        contentType: 'text/javascript',
        bytes: Buffer.from('throw new Error("oops")'),
      });
      const firstError = await assert.rejects(
        l.importFromResolvedURL('file:///failing')
      );
      assert.equal('oops', firstError.message);

      const secondError = await assert.rejects(
        l.importFromResolvedURL('file:///failing')
      );
      assert.equal(firstError, secondError);
    });
  });
});
