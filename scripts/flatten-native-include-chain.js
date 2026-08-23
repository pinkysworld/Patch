#!/usr/bin/env node
/**
 * Snapshot the historical v07–v11 native include chain into standalone modules
 * so current/frozen product facades no longer import those versioned files.
 *
 * Historical v07–v11 sources stay in the repository as executable evidence.
 * Re-run this script if those sources change; commit the generated snapshots.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(process.cwd(), 'src');

function moduleId(file) {
  return file.replace(/\.js$/, '').replace(/[^A-Za-z0-9]+/g, '_');
}

function parseNamedList(text) {
  return text.split(',').map(part => part.trim()).filter(Boolean).map(part => {
    const alias = part.match(/^(\w+)\s+as\s+(\w+)$/);
    return alias ? { imported: alias[1], local: alias[2] } : { imported: part, local: part };
  });
}

function parseModule(file) {
  const source = fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, '');
  const imports = [];
  const importPattern = /import\s+\{([^}]+)\}\s+from\s+(['"])(\.{1,2}\/[^'"]+)\2\s*;\s*/gs;
  let body = source.replace(importPattern, (_match, names, _quote, specifier) => {
    const target = path.posix.normalize(specifier.replace(/^\.\//, ''));
    imports.push({ names: parseNamedList(names), target });
    return '';
  });
  if (/^\s*import\s/m.test(body)) {
    throw new Error(`${file} still contains an import this flattener cannot rewrite.`);
  }

  const exports = [];
  body = body.replace(/^export\s+(const|class|function)\s+(\w+)/gm, (_match, kind, name) => {
    exports.push(name);
    return `${kind} ${name}`;
  });
  if (/^export\s/m.test(body)) {
    throw new Error(`${file} still contains an export this flattener cannot rewrite.`);
  }

  return { file, imports, body, exports };
}

function collect(entry, shouldInline) {
  const modules = new Map();
  const visit = file => {
    if (modules.has(file)) return;
    const parsed = parseModule(file);
    modules.set(file, parsed);
    for (const item of parsed.imports) {
      if (shouldInline(item.target)) visit(item.target);
    }
  };
  visit(entry);
  return modules;
}

function topological(modules, shouldInline) {
  const ordered = [];
  const seen = new Set();
  const visit = file => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const item of modules.get(file).imports) {
      if (shouldInline(item.target)) visit(item.target);
    }
    ordered.push(file);
  };
  for (const file of modules.keys()) visit(file);
  return ordered;
}

function emitBundle({ entry, outfile, banner, shouldInline, rewriteExternal }) {
  const modules = collect(entry, shouldInline);
  const order = topological(modules, shouldInline);
  const externals = new Map();

  for (const file of order) {
    for (const item of modules.get(file).imports) {
      if (shouldInline(item.target)) continue;
      const spec = rewriteExternal ? rewriteExternal(item.target) : `./${item.target}`;
      const bucket = externals.get(spec) ?? new Map();
      for (const name of item.names) {
        const prev = bucket.get(name.imported);
        if (prev && prev !== name.local) {
          throw new Error(`Conflicting external import of ${name.imported} from ${spec}`);
        }
        bucket.set(name.imported, name.local);
      }
      externals.set(spec, bucket);
    }
  }

  const lines = [
    '/* eslint-disable */',
    banner.trim(),
    ''
  ];

  for (const [spec, names] of externals) {
    const list = [...names.entries()].map(([imported, local]) => (
      imported === local ? imported : `${imported} as ${local}`
    )).join(', ');
    lines.push(`import { ${list} } from '${spec}';`);
  }
  if (externals.size) lines.push('');

  for (const file of order) {
    const parsed = modules.get(file);
    const id = moduleId(file);
    lines.push(`const __${id} = (() => {`);
    for (const item of parsed.imports) {
      if (!shouldInline(item.target)) continue;
      const list = item.names.map(name => (
        name.imported === name.local ? name.local : `${name.imported}: ${name.local}`
      )).join(', ');
      lines.push(`  const { ${list} } = __${moduleId(item.target)};`);
    }
    lines.push(parsed.body.replace(/^/gm, '  ').replace(/^\s+$/gm, ''));
    lines.push(`  return { ${parsed.exports.join(', ')} };`);
    lines.push('})();');
    lines.push('');
  }

  // Re-export every inlined public name so seal flattening can reuse IR helpers.
  const allExports = [];
  const seenExport = new Set();
  for (const file of order) {
    for (const name of modules.get(file).exports) {
      if (seenExport.has(name)) continue;
      seenExport.add(name);
      allExports.push({ name, file });
    }
  }
  for (const item of allExports) {
    lines.push(`export const ${item.name} = __${moduleId(item.file)}.${item.name};`);
  }
  lines.push('');

  const target = path.join(root, outfile);
  fs.writeFileSync(target, `${lines.join('\n')}\n`);
  return { outfile, modules: order.length, exports: allExports.length };
}

const irInline = target => /^native-gui-ir(?:-v0[89]|-v1[01])?\.js$/.test(target);
const irResult = emitBundle({
  entry: 'native-gui-ir-v11.js',
  outfile: 'native-gui-frozen-lower.js',
  banner: `/**
 * Standalone frozen-base Native GUI IR snapshot (historical v07–v11).
 * Generated by scripts/flatten-native-include-chain.js. Do not edit by hand.
 * Frozen/current product facades import this file instead of the versioned chain.
 */`,
  shouldInline: irInline
});

const sealInline = target => target === 'sealed-native-gui.js' || target === 'sealed-native-gui-v11.js';
const sealResult = emitBundle({
  entry: 'sealed-native-gui-v11.js',
  outfile: 'native-gui-frozen-seal.js',
  banner: `/**
 * Standalone frozen-base sealed payload snapshot (historical v06–v11).
 * Generated by scripts/flatten-native-include-chain.js. Do not edit by hand.
 * Payload v12 sealing imports this file instead of sealed-native-gui-v11.js.
 */`,
  shouldInline: sealInline,
  rewriteExternal: target => (irInline(target) ? './native-gui-frozen-lower.js' : `./${target}`)
});

console.log(`wrote src/${irResult.outfile} from ${irResult.modules} IR modules (${irResult.exports} exports)`);
console.log(`wrote src/${sealResult.outfile} from ${sealResult.modules} sealer modules (${sealResult.exports} exports)`);
