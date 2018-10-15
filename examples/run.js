#!/usr/bin/env node

'use strict';

const path = require('path');

const Loader = require('../')
  .enableDynamicImport()
  .enableImportMeta();

const registerUnprefixedNodeCoreModules = require('../resolve/node-core');

registerUnprefixedNodeCoreModules(Loader.current)
  .import(`file://${path.resolve(process.argv[2])}`)
  .then(console.log, console.error);
