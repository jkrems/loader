/**
 * The entrypoint of a new process (including worker_threads).
 */

'use strict';

const ModuleLoader = require('./module_loader');

(async () => {
  console.log('create module loader');
  const mainLoader = new ModuleLoader();
  const ns = await mainLoader.import('https://example.com/bin.js');
  console.log('ns', ns);
})().catch(e =>
  process.nextTick(() => {
    throw e;
  })
);
