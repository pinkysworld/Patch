import { parse } from './parser.js';
import { buildOutlineModel } from './studio-outline-model.js';

export function buildStudioQuickOpenItems(files = []) {
  const items = [];
  for (const file of files) {
    const path = String(file?.path ?? '').trim();
    if (!path) continue;
    const content = String(file?.content ?? '');
    items.push({
      id: `file:${path}`,
      type: 'file',
      label: path,
      detail: 'Project file',
      keywords: `file source project ${path}`,
      file: path,
      line: null,
      symbolKind: null
    });

    let groups = [];
    try {
      groups = buildOutlineModel(parse(content));
    } catch {
      // Invalid source still keeps the file quick-open entry. Symbols resume as
      // soon as the existing parser can build the same model used by Project Tree.
    }

    for (const group of groups) {
      for (const symbol of group.items) {
        const line = Number(symbol.line);
        const meta = String(symbol.meta ?? '').trim();
        const kind = String(symbol.kind ?? group.key ?? 'symbol');
        items.push({
          id: `symbol:${path}:${line}:${kind}:${symbol.label}`,
          type: 'symbol',
          label: String(symbol.label ?? kind),
          detail: `${path}:${line} · ${group.label}${meta ? ` · ${meta}` : ''}`,
          keywords: `symbol ${group.key} ${group.label} ${kind} ${symbol.label ?? ''} ${meta} ${path}`,
          file: path,
          line: Number.isInteger(line) && line > 0 ? line : null,
          symbolKind: kind
        });
      }
    }
  }
  return items;
}

export function rankStudioQuickOpenItems(items, query) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [...items];
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  return items
    .map((item, index) => ({ item, index, score: scoreTokens(searchText(item), tokens) }))
    .filter(entry => entry.score >= 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(entry => entry.item);
}

export function fuzzyQuickOpenScore(value, query) {
  const haystack = normalize(value);
  const needle = normalize(query);
  if (!needle) return 0;
  if (!haystack) return -1;

  const direct = haystack.indexOf(needle);
  if (direct >= 0) {
    const boundary = direct === 0 || /[^a-z0-9]/.test(haystack[direct - 1] ?? '');
    return 10_000 + (boundary ? 1_000 : 0) - direct * 4 - Math.max(0, haystack.length - needle.length);
  }

  let position = 0;
  let previous = -2;
  let score = 0;
  for (const char of needle) {
    const found = haystack.indexOf(char, position);
    if (found < 0) return -1;
    const contiguous = found === previous + 1;
    const boundary = found === 0 || /[^a-z0-9]/.test(haystack[found - 1] ?? '');
    score += 20 + (contiguous ? 18 : 0) + (boundary ? 12 : 0) - Math.min(12, found - position);
    previous = found;
    position = found + 1;
  }
  return score - Math.max(0, haystack.length - needle.length);
}

function scoreTokens(text, tokens) {
  let score = 0;
  for (const token of tokens) {
    const tokenScore = fuzzyQuickOpenScore(text, token);
    if (tokenScore < 0) return -1;
    score += tokenScore;
  }
  return score;
}

function searchText(item) {
  return `${item?.label ?? ''} ${item?.detail ?? ''} ${item?.keywords ?? ''}`;
}

function normalize(value) {
  return String(value ?? '').trim().toLocaleLowerCase();
}
