import Module from 'module';
// TODO: Use once this lands in a node 10 release
// import { fileURLToPath as fromPath } from 'url';

const req = Module.createRequireFromPath(new URL(import.meta.url).pathname);
export default req('./cjs.js');
