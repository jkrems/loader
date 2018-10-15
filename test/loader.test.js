'use strict';

const fs = require('fs');
const { pathToFileURL } = require('url');

const assert = require('assertive');

const Loader = require('../');

const { enableImportMeta, enableDynamicImport } = Loader;

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
      const a = await localLoader.import('file:///a');
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
      const firstError = await assert.rejects(l.import('file:///failing'));
      assert.equal('oops', firstError.message);

      const secondError = await assert.rejects(l.import('file:///failing'));
      assert.equal(firstError, secondError);
    });
  });

  describe('with defaults', () => {
    let loader;
    before('create loader', () => {
      loader = new Loader();
    });

    it('can import a core module, including named exports', async () => {
      const fsNamespace = await loader.import('node:fs');
      assert.equal(fs, fsNamespace.default);
      assert.equal(fs.readFile, fsNamespace.readFile);
    });

    describe('with import.meta & import()', () => {
      before(() => {
        enableDynamicImport();
        enableImportMeta();
      });

      it('can load import.meta', async () => {
        const metaURL = pathToFileURL(
          require.resolve('../examples/import-meta.mjs')
        ).href;
        const metaNamespace = await loader.import(metaURL);
        assert.deepEqual(
          {
            url: metaURL,
          },
          metaNamespace.default
        );
      });

      it('can use dynamic import to load import.meta', async () => {
        const metaURL = pathToFileURL(
          require.resolve('../examples/import-meta.mjs')
        ).href;
        const wrapURL = pathToFileURL(
          require.resolve('../examples/import-dynamic-sibling.mjs')
        );
        const { importSibling } = await loader.import(wrapURL.toString());
        assert.hasType(Function, importSibling);
        const metaNamespace = await importSibling('./import-meta.mjs');
        assert.deepEqual(
          {
            url: metaURL,
          },
          metaNamespace.default
        );
      });
    });
  });
});
