#!/usr/bin/env node

'use strict';

require('../').enableDynamicImport();

import(process.argv[2]).then(console.log, console.error);
