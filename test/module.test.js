'use strict';

const assert = require('assertive');

const Module = require('../lib/module');

describe('Module', () => {
  it('can be created from source', () => {
    const m = new Module('file:///a.mjs');
    assert.equal('file:///a.mjs', m.url);
    assert.equal(Module.kUncompiled, m.status);

    m.compile('export default true; export const foo = 42; foo;');
    assert.equal(Module.kUninstantiated, m.status);
    m.instantiate();
    assert.equal(Module.kInstantiated, m.status);
    const result = m.evaluate();
    assert.equal(42, result);
    assert.equal(Module.kEvaluated, m.status);
    assert.deepEqual(
      { foo: 42, default: true },
      Object.assign({}, m.namespace)
    );
    assert.equal(undefined, m.exception);

    const failing = new Module('file:///b.mjs');
    assert.equal(Module.kUncompiled, failing.status);
    failing.compile('throw new Error("oops");');
    failing.instantiate();
    const err = assert.throws(() => failing.evaluate());
    assert.equal('oops', err.message);
    assert.include('file:///b.mjs:1:7', err.stack);
    assert.equal(err, failing.exception);
  });

  it('can be linked to other modules', () => {
    const m = new Module('file:///a.mjs');
    m.compile(`\
import { x } from 'dep1';
import y from 'dep2';

x + 2 * y;
`);
    assert.deepEqual(['dep1', 'dep2'], m.requests);

    const dep1 = new Module('dep1');
    dep1.compile('export const x = 3;');
    assert.equal(false, m.isResolved('dep1'));
    m.resolveRequest('dep1', dep1);
    assert.equal(true, m.isResolved('dep1'));
    const dep2 = new Module('dep2');
    dep2.compile('export default 4;');
    m.resolveRequest('dep2', dep2);

    m.instantiate();
    assert.equal(3 + 2 * 4, m.evaluate());
  });
});
