import Module from 'module';

const req = Module.createRequireFromPath(new URL(import.meta.url).pathname);
export default req('./cjs.js');
