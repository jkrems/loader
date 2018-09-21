'use strict';

const bindings = require('bindings');

const native = bindings('loader');

native.SetDynamicImportCallback();
