#!/usr/bin/env node

'use strict';

require('../')
  .enableDynamicImport()
  .enableImportMeta()
  .addPackageJSONToMap(require('../package.json'));

import(process.argv[2]).then(console.log, console.error);
