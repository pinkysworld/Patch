import { normalizeImageListId, normalizeImageListItemName } from './imagelist-control.js';

export const PATCH_TREE_NODE_PRESENTATION_VERSION = '0.1';
export const PATCH_TREE_NODE_HINT_VERSION = '0.1';
export const PATCH_TREE_NODE_STATE_VERSION = '0.1';
export const PATCH_TREE_NODE_STATES = Object.freeze(['muted', 'info', 'success', 'warning', 'danger']);

export class PatchTreeNodePresentationError extends Error {
  constructor(message, code = 'TREE_NODE_PRESENTATION_INVALID') {
    super(message);
    this.name = 'PatchTreeNodePresentationError';
    this.code = code;
  }
}

export function parseTreeNodeImageBinding(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const match = text.match(/^([A-Za-z_]\w*)\.([A-Za-z_]\w*)$/);
  if (!match) {
    throw new PatchTreeNodePresentationError(
      'TreeView node image binding must be ImageList.item such as tree_icons.folder.',
      'TREE_NODE_IMAGE_SYNTAX'
    );
  }
  try {
    return Object.freeze({
      imageListId: normalizeImageListId(match[1]),
      imageItem: normalizeImageListItemName(match[2])
    });
  } catch (error) {
    throw new PatchTreeNodePresentationError(error?.message ?? String(error), error?.code ?? 'TREE_NODE_IMAGE');
  }
}

export function formatTreeNodeImageBinding(input) {
  if (!input) return '';
  const list = trimOrNull(input.imageListId);
  const item = trimOrNull(input.imageItem);
  if (!list && !item) return '';
  if (!list || !item) {
    throw new PatchTreeNodePresentationError('TreeView node image needs both ImageList and item names.', 'TREE_NODE_IMAGE');
  }
  const binding = parseTreeNodeImageBinding(`${list}.${item}`);
  return `${binding.imageListId}.${binding.imageItem}`;
}

export function normalizeTreeNodeHint(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}

export function parseTreeNodeHintLiteral(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const source = String(value).trim();
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new PatchTreeNodePresentationError(
      'TreeView node hint must be a quoted text literal such as hint "Open source folder".',
      'TREE_NODE_HINT_SYNTAX'
    );
  }
  if (typeof parsed !== 'string' || !parsed.trim()) {
    throw new PatchTreeNodePresentationError(
      'TreeView node hint must be non-empty quoted text.',
      'TREE_NODE_HINT'
    );
  }
  return parsed;
}

export function formatTreeNodeHint(value) {
  const hint = normalizeTreeNodeHint(value);
  return hint ? JSON.stringify(hint) : '';
}

export function normalizeTreeNodeState(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const state = String(value).trim().toLowerCase();
  if (!PATCH_TREE_NODE_STATES.includes(state)) {
    throw new PatchTreeNodePresentationError(
      `TreeView node state must be one of: ${PATCH_TREE_NODE_STATES.join(', ')}.`,
      'TREE_NODE_STATE'
    );
  }
  return state;
}

export function formatTreeNodeState(value) {
  return normalizeTreeNodeState(value) ?? '';
}

export function parsePatchTreeNodeDeclaration(value) {
  const source = String(value ?? '').trim();
  const header = /^node\b/i.exec(source);
  if (!header) throw treeNodeSourceSyntax();
  let index = header[0].length;
  if (index < source.length && !/\s/.test(source[index])) throw treeNodeSourceSyntax();
  index = skipSpace(source, index);
  if (index >= source.length) throw treeNodeSourceSyntax();

  const keywordAt = findTreeNodeClause(source, index);
  const labelExpr = source.slice(index, keywordAt < 0 ? source.length : keywordAt).trim();
  if (!labelExpr) throw new PatchTreeNodePresentationError('TreeView node label cannot be empty.', 'TREE_NODE_LABEL');

  const clauses = parseTreeNodeClauses(source, keywordAt < 0 ? source.length : keywordAt);
  return Object.freeze({
    labelExpr,
    imageListId: clauses.imageListId,
    imageItem: clauses.imageItem,
    ...(clauses.hint ? { hint: clauses.hint } : {}),
    ...(clauses.state ? { state: clauses.state } : {})
  });
}

export function formatPatchTreeNodeDeclaration(input = {}) {
  const labelExpr = String(input.labelExpr ?? '').trim();
  if (!labelExpr) throw new PatchTreeNodePresentationError('TreeView node label cannot be empty.', 'TREE_NODE_LABEL');
  const image = formatTreeNodeImageBinding(input);
  const hint = formatTreeNodeHint(input.hint);
  const state = formatTreeNodeState(input.state);
  return `node ${labelExpr}${image ? ` image ${image}` : ''}${hint ? ` hint ${hint}` : ''}${state ? ` state ${state}` : ''}`;
}

export function treeNodeHasImage(node) {
  return Boolean(node?.imageListId && node?.imageItem);
}

export function treeNodeHasHint(node) {
  return Boolean(normalizeTreeNodeHint(node?.hint));
}

export function treeNodeHasState(node) {
  return Boolean(normalizeTreeNodeState(node?.state));
}

export function countTreeNodeImages(nodes) {
  let count = 0;
  for (const node of nodes ?? []) {
    if (treeNodeHasImage(node)) count += 1;
    count += countTreeNodeImages(node.children);
  }
  return count;
}

export function countTreeNodeHints(nodes) {
  let count = 0;
  for (const node of nodes ?? []) {
    if (treeNodeHasHint(node)) count += 1;
    count += countTreeNodeHints(node.children);
  }
  return count;
}

export function countTreeNodeStates(nodes) {
  let count = 0;
  for (const node of nodes ?? []) {
    if (treeNodeHasState(node)) count += 1;
    count += countTreeNodeStates(node.children);
  }
  return count;
}

export function visitTreeNodeImages(nodes, visit) {
  for (const node of nodes ?? []) {
    if (treeNodeHasImage(node)) visit(node);
    visitTreeNodeImages(node.children, visit);
  }
}

export function resolveTreeNodeImageBinding(lists, node, line = null) {
  if (!treeNodeHasImage(node)) return null;
  const list = lists instanceof Map ? lists.get(node.imageListId) : lists?.[node.imageListId];
  const where = line == null ? 'TreeView node' : `line ${line}: TreeView node`;
  if (!list) {
    throw new PatchTreeNodePresentationError(
      `${where} image ${node.imageListId}.${node.imageItem} refers to ImageList '${node.imageListId}' that is not defined on this Form.`,
      'TREE_NODE_IMAGE_LIST_MISSING'
    );
  }
  const item = (list.items ?? []).find(entry => entry.name === node.imageItem);
  if (!item) {
    throw new PatchTreeNodePresentationError(
      `${where} image ${node.imageListId}.${node.imageItem} refers to ImageList item '${node.imageItem}' that is not in '${node.imageListId}'.`,
      'TREE_NODE_IMAGE_ITEM_MISSING'
    );
  }
  return Object.freeze({
    imageListId: node.imageListId,
    imageItem: node.imageItem,
    sourceExpr: item.sourceExpr,
    resourceId: item.resourceId ?? null,
    width: Number(list.logicalWidth) || 16,
    height: Number(list.logicalHeight) || 16
  });
}

const TREE_NODE_CLAUSE_ORDER = ['image', 'hint', 'state'];

function treeNodeSourceSyntax() {
  return new PatchTreeNodePresentationError(
    'TreeView node syntax is node <label> [image list.item] [hint "text"] [state muted|info|success|warning|danger].',
    'TREE_NODE_SOURCE_SYNTAX'
  );
}

function skipSpace(source, index) {
  while (index < source.length && /\s/.test(source[index])) index += 1;
  return index;
}

function quotedTextLength(source, index) {
  if (source[index] !== '"') return 0;
  const match = /^"(?:\\.|[^"\\])*"/.exec(source.slice(index));
  return match ? match[0].length : 0;
}

function clauseAt(source, index) {
  if (index > 0 && !/\s/.test(source[index - 1])) return null;
  const match = /^(image|hint|state)(?=\s|$)/i.exec(source.slice(index));
  if (!match) return null;
  return { name: match[1].toLowerCase(), length: match[1].length };
}

function findTreeNodeClause(source, from) {
  for (let index = from; index < source.length;) {
    if (source[index] === '"') {
      const length = quotedTextLength(source, index);
      if (!length) return -1;
      index += length;
      continue;
    }
    if (clauseAt(source, index)) return index;
    index += 1;
  }
  return -1;
}

function readToken(source, index) {
  const match = /^\S+/.exec(source.slice(index));
  return match ? match[0] : '';
}

function readHintLiteral(source, index) {
  if (index >= source.length) return '';
  if (source[index] === '"') {
    const length = quotedTextLength(source, index);
    return length ? source.slice(index, index + length) : source.slice(index);
  }
  return readToken(source, index);
}

function requireImageBinding(token) {
  const binding = parseTreeNodeImageBinding(token);
  if (!binding) {
    throw new PatchTreeNodePresentationError(
      'TreeView node image binding must be ImageList.item such as tree_icons.folder.',
      'TREE_NODE_IMAGE_SYNTAX'
    );
  }
  return binding;
}

function parseTreeNodeClauses(source, index) {
  let stage = 0;
  let imageListId = null;
  let imageItem = null;
  let hint;
  let state;
  while (index < source.length) {
    index = skipSpace(source, index);
    if (index >= source.length) break;
    const clause = clauseAt(source, index);
    if (!clause) throw treeNodeSourceSyntax();
    const position = TREE_NODE_CLAUSE_ORDER.indexOf(clause.name);
    if (position < stage) throw treeNodeSourceSyntax();
    stage = position + 1;
    index = skipSpace(source, index + clause.length);
    if (clause.name === 'image') {
      const token = readToken(source, index);
      const binding = requireImageBinding(token);
      imageListId = binding.imageListId;
      imageItem = binding.imageItem;
      index += token.length;
    } else if (clause.name === 'hint') {
      const literal = readHintLiteral(source, index);
      const parsed = parseTreeNodeHintLiteral(literal);
      if (!parsed) {
        throw new PatchTreeNodePresentationError(
          'TreeView node hint must be a quoted text literal such as hint "Open source folder".',
          'TREE_NODE_HINT_SYNTAX'
        );
      }
      hint = parsed;
      index += literal.length;
    } else {
      const token = readToken(source, index);
      if (!token) throw treeNodeSourceSyntax();
      state = normalizeTreeNodeState(token);
      index += token.length;
    }
  }
  return { imageListId, imageItem, hint, state };
}

function trimOrNull(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}
