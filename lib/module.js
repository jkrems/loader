'use strict';

const bindings = require('bindings');

const { ModuleWrap: Module } = bindings('loader');

const createDynamicModule = require('./create_dynamic_module');

Module.prototype.setLazyStaticExports = function setLazyStaticExports(
  exportKeys,
  getExportValues
) {
  return createDynamicModule(this, exportKeys, reflect => {
    const values = getExportValues();
    for (const key of exportKeys) {
      reflect.exports[key].set(values[key]);
    }
  });
};

module.exports = Module;
