'use strict';

/* global WebAssembly */

function initWASM(target, resource, Module) {
  // super simplistic and just for demo purposes.
  const wasmModule = new WebAssembly.Module(resource.bytes);
  const importArr = WebAssembly.Module.imports(wasmModule);
  const importsBySpecifier = new Map();
  const wasmImports = importArr
    .map(({ module: specifier, name }, idx) => {
      if (!importsBySpecifier.has(specifier)) {
        importsBySpecifier.set(specifier, []);
      }
      importsBySpecifier.get(specifier).push({ name, idx });
      if (specifier === '') {
        throw new TypeError(`Use of invalid specifier "" in ${target.url}`);
      }
      return `import { ${name} as $in${idx} } from ${JSON.stringify(
        specifier
      )}`;
    })
    .join('\n');
  const exportArr = WebAssembly.Module.exports(wasmModule);
  const wasmExports = exportArr
    .map(({ name }, idx) => {
      return `const $out${idx} = instance.exports[${JSON.stringify(name)}]`;
    })
    .join('\n');
  const exportList = exportArr.map(({ name }, idx) => {
    return `$out${idx} as ${name}`;
  });
  const exportStmt = exportList.length
    ? `export { ${exportList.join(', ')} }`
    : '';
  const wasmWrap = `\
import { module } from '';
${wasmImports}

const imports = {
${[...importsBySpecifier.entries()]
    .map(([specifier, values]) => {
      return `\
[${JSON.stringify(specifier)}]: {
${values
        .map(({ name, idx }) => {
          return `[${JSON.stringify(name)}]: $in${idx},`;
        })
        .join('\n    ')}
},`;
    })
    .join('\n  ')}
};
const instance = new WebAssembly.Instance(module, imports);

${wasmExports}
${exportStmt}
`;

  const moduleProvider = new Module(`wasm-compile:${target.url}`);
  moduleProvider.compile(`\
export let module = null;

(function setModule(m) {
module = m;
});`);
  moduleProvider.instantiate();
  const setModule = moduleProvider.evaluate();
  setModule(wasmModule);

  target.compile(wasmWrap);
  target.resolveRequest('', moduleProvider);
}
module.exports = initWASM;
