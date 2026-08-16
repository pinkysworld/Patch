export const PATCH_CALL_SITE_VALIDATION_VERSION = '0.1';

/**
 * Independently bind raw `do recipe(args)` source sites to production AST call
 * sites. This module does not import parser.js or consume lowered IR.
 *
 * It validates syntactic call identity only: caller recipe context, source line,
 * callee name and exact trimmed argument texts. Concrete argument semantics are
 * checked separately by the call witness/Lean certificate layers.
 */
export function validateCallSites(source, ast) {
  const rawSites = collectRawCallSites(source);
  const astSites = collectAstCallSites(ast);
  const reasons = [];
  const max = Math.max(rawSites.length, astSites.length);
  const comparisons = [];

  for (let index = 0; index < max; index += 1) {
    const raw = rawSites[index] ?? null;
    const production = astSites[index] ?? null;
    const matches = Boolean(raw && production && canonical(raw) === canonical(production));
    const itemReasons = [];
    if (!raw) itemReasons.push('independent raw-source call site is missing');
    if (!production) itemReasons.push('production AST call site is missing');
    if (raw && production && !matches) {
      itemReasons.push(`raw-source call site disagrees with production AST: raw=${canonical(raw)} production=${canonical(production)}`);
    }
    reasons.push(...itemReasons.map(reason => `site ${index + 1}: ${reason}`));
    comparisons.push({ index, validated: matches, raw, production, reasons: itemReasons });
  }

  return {
    format: 'patch-call-site-validation',
    version: PATCH_CALL_SITE_VALIDATION_VERSION,
    producer: 'raw-source-independent-call-site-parser',
    validated: reasons.length === 0,
    rawSites,
    productionSites: astSites,
    comparisons,
    reasons,
    summary: {
      rawSites: rawSites.length,
      productionSites: astSites.length,
      validated: comparisons.filter(item => item.validated).length,
      mismatches: comparisons.filter(item => !item.validated).length
    }
  };
}

export function collectRawCallSites(source) {
  const rows = scanRows(source);
  const functionStack = [];
  const sites = [];

  for (const row of rows) {
    while (functionStack.length && row.indent <= functionStack.at(-1).indent) functionStack.pop();

    const fn = row.text.match(/^make\s+([A-Za-z_]\w*)\s*\([^)]*\)\s*:\s*$/);
    if (fn) {
      functionStack.push({ name: fn[1], indent: row.indent });
      continue;
    }

    if (!/^do\b/.test(row.text)) continue;
    const parsed = parseRawCall(row.text, row.line);
    sites.push({
      caller: functionStack.at(-1)?.name ?? '$program',
      callee: parsed.callee,
      line: row.line,
      args: parsed.args
    });
  }
  return sites;
}

export function collectAstCallSites(ast) {
  const sites = [];

  const visit = (nodes, caller) => {
    for (const node of nodes ?? []) {
      if (node.kind === 'function') {
        visit(node.body ?? [], node.name);
        continue;
      }
      if (node.kind === 'call') {
        sites.push({
          caller,
          callee: node.name,
          line: node.line ?? null,
          args: (node.args ?? []).map(value => String(value).trim())
        });
      }
      if (node.body) visit(node.body, caller);
      if (node.thenBody) visit(node.thenBody, caller);
      if (node.elseBody) visit(node.elseBody, caller);
    }
  };

  visit(ast, '$program');
  return sites;
}

function parseRawCall(text, line) {
  const prefix = text.match(/^do\s+([A-Za-z_]\w*)\s*\(/);
  if (!prefix) throw new Error(`line ${line}: raw call-site validator cannot parse '${text}'`);
  const callee = prefix[1];
  const open = text.indexOf('(', prefix[0].length - 1);
  const close = matchingCloseParen(text, open);
  if (close < 0 || text.slice(close + 1).trim()) {
    throw new Error(`line ${line}: raw call-site validator found malformed trailing call syntax`);
  }
  return { callee, args: splitTopLevelArgs(text.slice(open + 1, close), line) };
}

function splitTopLevelArgs(text, line) {
  if (!text.trim()) return [];
  const args = [];
  let current = '';
  let paren = 0;
  let bracket = 0;
  let quote = null;
  let escaped = false;

  for (const char of text) {
    if (quote) {
      current += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") { quote = char; current += char; continue; }
    if (char === '(') paren += 1;
    else if (char === ')') paren -= 1;
    else if (char === '[') bracket += 1;
    else if (char === ']') bracket -= 1;
    if (paren < 0 || bracket < 0) throw new Error(`line ${line}: unbalanced call argument delimiters`);
    if (char === ',' && paren === 0 && bracket === 0) {
      if (!current.trim()) throw new Error(`line ${line}: empty call argument`);
      args.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  if (quote || paren !== 0 || bracket !== 0) throw new Error(`line ${line}: unterminated call argument syntax`);
  if (!current.trim()) throw new Error(`line ${line}: empty trailing call argument`);
  args.push(current.trim());
  return args;
}

function matchingCloseParen(text, open) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = open; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === '(') depth += 1;
    else if (char === ')') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function scanRows(source) {
  const rows = [];
  String(source).replace(/\t/g, '  ').split(/\r?\n/).forEach((raw, index) => {
    const text = raw.trim();
    if (!text || raw.trimStart().startsWith('#')) return;
    rows.push({ text, indent: raw.length - raw.trimStart().length, line: index + 1 });
  });
  return rows;
}

function canonical(value) { return JSON.stringify(value); }
