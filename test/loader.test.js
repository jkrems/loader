'use strict';

const assert = require('assertive');

const loader = require('../');

describe('loader', () => {
  it('is empty', () => {
    assert.deepEqual({}, loader);
  });
});
