#!/usr/bin/env node

'use strict';

const path = require('path');

const loader = require('../')
  .enableDynamicImport()
  .enableImportMeta()
  .registerUnprefixedNodeCoreModules();

loader
  .import(`file://${path.resolve(process.argv[2])}`)
  .then(console.log, console.error);
