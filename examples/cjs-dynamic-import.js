'use strict';

require('../').enableDynamicImport();

import('./x.js').then(console.log, console.error);
