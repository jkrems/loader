'use strict';

const vm = require('vm');

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
  });

  describe('.exception', () => {
    it('exposes compilation error', () => {
      const m = new Module('file:///a.mjs');
      const err = assert.throws(() => m.compile('const not valid'));
      assert.equal('SyntaxError', err.name);
      assert.equal(err, m.exception);
      assert.equal(Module.kErrored, m.status);
    });

    it('exposes errors during evaluation', () => {
      const failing = new Module('file:///b.mjs');
      assert.equal(Module.kUncompiled, failing.status);
      failing.compile('throw new Error("oops");');
      failing.instantiate();
      const err = assert.throws(() => failing.evaluate());
      assert.equal('oops', err.message);
      assert.include('file:///b.mjs:1:7', err.stack);
      assert.equal(err, failing.exception);
      assert.equal(Module.kErrored, failing.status);
    });

    it('exposes errors in dependencies', () => {
      const dep = new Module('file:///dep.mjs');
      dep.compile('throw new Error("dep error");');
      dep.instantiate();

      const m = new Module('file:///a.mjs');
      m.compile('import "dep"');
      m.resolveRequest('dep', dep);
      m.instantiate();
      const err = assert.throws(() => m.evaluate());
      assert.equal('dep error', err.message);
      assert.equal(err, m.exception);
      assert.equal(Module.kErrored, m.status);
    });

    it('exposes link errors', () => {
      const dep = new Module('file:///dep.mjs');
      dep.compile('');
      dep.instantiate();

      const m = new Module('file:///a.mjs');
      m.compile('import { someExport } from "dep-key"');
      m.resolveRequest('dep-key', dep);
      const err = assert.throws(() => m.instantiate());
      assert.include('someExport', err.message);
      assert.include('dep-key', err.message);
    });
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

  it('can be set from exports', () => {
    const m = new Module('file:///lazy.mjs');
    let called = false;
    m.setLazyStaticExports(['x', 'y', 'default'], () => {
      called = true;
      return { x: 7, y: 11, default: 'ok' };
    });

    const proxy = new Module('file:///proxy.mjs');
    proxy.compile('export * from "lazy"; export const proxied = true;');
    proxy.resolveRequest('lazy', m);
    proxy.instantiate();
    assert.equal(false, called);
    proxy.evaluate();
    assert.equal(true, called);
    assert.deepEqual(
      { x: 7, y: 11, proxied: true },
      Object.assign({}, proxy.namespace)
    );
    assert.equal('ok', m.namespace.default);
  });

  describe('in 2nd context', () => {
    const ctxSandbox = { secretGlobal: 42 };
    const ctx = vm.createContext(ctxSandbox);
    const ctxGlobal = vm.runInContext('this', ctx);
    const exportSecretGlobalType = 'export default typeof secretGlobal;';

    it('does not use the context by default', () => {
      const m = new Module('file:///a.mjs');
      m.compile(exportSecretGlobalType);
      m.instantiate();
      m.evaluate();
      assert.equal('undefined', m.namespace.default);
    });

    it('can run a module in custom context', () => {
      const m = new Module('file:///a.mjs', ctxGlobal);
      m.compile(exportSecretGlobalType);
      m.instantiate();
      m.evaluate();
      assert.equal('number', m.namespace.default);
    });
  });
});
