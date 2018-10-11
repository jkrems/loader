#!/usr/bin/env node

'use strict';

require('../')
  .enableDynamicImport()
  .enableImportMeta()
  .registerUnprefixedNodeCoreModules()
  .addPackageLockToMap(require('../package-lock.json'));

import(process.argv[2]).then(console.log, console.error);
