'use strict';

require('../').enableDynamicImport();

import('./imports.js').then(console.log, console.error);
