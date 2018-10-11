import { createRequireFromPath } from 'module';
import { fileURLToPath } from 'url';

const req = createRequireFromPath(fileURLToPath(import.meta.url));
export default req('./cjs.js');
