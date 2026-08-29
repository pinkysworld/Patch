import {
  addDesignerMenu,
  addDesignerMenuItem,
  ensureDesignerMenuItemHandler,
  insertDesignerMenuSeparator,
  listDesignerMenus,
  moveDesignerMenuItem,
  removeDesignerMenu,
  removeDesignerMenuEntry,
  updateDesignerMenu,
  updateDesignerMenuItem
} from './src/designer-menu.js?v=9ad29318e93c7c71';

export const PATCH_MENU_DESIGNER_VERSION = '0.1';

const doc = typeof document === 'undefined' ? null : document;
const code = doc?.querySelector('#code') ?? null;
const designer = doc?.querySelector('#designer') ?? null;
const toolbar = doc?.querySelector('#designer .designer-toolbar') ?? null;
let dialog = null;
let selectedMenuIndex = 0;
let selectedEntryIndex = 0;

if (doc) {
  installStylesheet();
  queueMicrotask(install);
}

export function listDesignerBooleanState(source) {
  const names = [];
  const pattern = /^\s*create\s+boolean\s+([A-Za-z_]\w*)\b/gm;
  for (const match of String(source).matchAll(pattern)) names.push(match[1]);
  return [...new Set(names)];
}

export function displayDesignerExpression(expression) {
  const text = String(expression ?? '').trim();
  if (!text) return '';
  if (text.startsWith('"') && text.endsWith('"')) {
    try { return JSON.parse(text); } catch { return text.slice(1, -1); }
  }
  if (text.startsWith("'") && text.endsWith("'")) return text.slice(1, -1);
  return text;
}

export function designerLiteralExpression(value, originalExpression = null) {
  const next = String(value ?? '');
  if (originalExpression !== null && next === displayDesignerExpression(originalExpression)) return String(originalExpression);
  return JSON.stringify(next);
}

function install() {
  if (!designer || !toolbar || !code || designer.dataset.patchMenuDesigner === 'true') return;
  designer.dataset.patchMenuDesigner = 'true';

  const button = doc.createElement('button');
  button.id = 'openMenuDesigner';
  button.className = 'secondary small designer-menu-button';
  button.type = 'button';
  button.textContent = 'Menus…';
  button.title = 'Open the source-backed Menu Designer';
  button.setAttribute('aria-label', 'Open Menu Designer');
  toolbar.appendChild(button);
  button.addEventListener('click', openMenuDesigner);

  dialog = createDialog();
  doc.body.appendChild(dialog);
  code.addEventListener('input', syncIfOpen);
  code.addEventListener('change', syncIfOpen);
  doc.querySelector('#patchFormSelect')?.addEventListener('change', syncIfOpen);
}

function createDialog() {
  const shell = doc.createElement('dialog');
  shell.id = 'designerMenuDialog';
  shell.className = 'designer-menu-dialog';
  shell.setAttribute('aria-labelledby', 'designerMenuDialogTitle');
  shell.innerHTML = `
    <form method="dialog" class="designer-menu-dialog-frame">
      <header class="designer-menu-dialog-header">
        <div>
          <span class="designer-menu-kicker">Form chrome</span>
          <h3 id="designerMenuDialogTitle">Menu Designer</h3>
        </div>
        <button class="secondary small" value="close" type="submit">Close</button>
      </header>
      <p class="designer-menu-help">Menus remain ordinary Patch source. Items expose OnClick, portable shortcuts and optional Boolean enabled/checked bindings.</p>
      <div class="designer-menu-grid">
        <section class="designer-menu-pane" aria-label="Menus">
          <div class="designer-menu-pane-title"><strong>Menus</strong><span id="designerMenuFormLabel"></span></div>
          <select id="designerMenuList" size="7" aria-label="Menus on active Form"></select>
          <div class="designer-menu-actions">
            <button id="designerMenuAdd" class="secondary" type="button">+ Menu</button>
            <button id="designerMenuDelete" class="secondary" type="button">Delete</button>
          </div>
          <label class="designer-menu-field">Caption
            <input id="designerMenuCaption" type="text" autocomplete="off">
          </label>
          <button id="designerMenuApply" class="secondary" type="button">Apply menu</button>
        </section>
        <section class="designer-menu-pane designer-menu-items-pane" aria-label="Menu items">
          <div class="designer-menu-pane-title"><strong>Items</strong><span id="designerMenuEntryCount"></span></div>
          <select id="designerMenuEntries" size="10" aria-label="Items in selected menu"></select>
          <div class="designer-menu-actions designer-menu-entry-actions">
            <button id="designerMenuAddItem" class="secondary" type="button">+ Item</button>
            <button id="designerMenuAddSeparator" class="secondary" type="button">+ Separator</button>
            <button id="designerMenuEarlier" class="secondary" type="button">↑</button>
            <button id="designerMenuLater" class="secondary" type="button">↓</button>
            <button id="designerMenuDeleteEntry" class="secondary" type="button">Delete</button>
          </div>
        </section>
        <section class="designer-menu-pane designer-menu-properties" aria-label="Menu item properties">
          <div class="designer-menu-pane-title"><strong>Item properties</strong><span id="designerMenuItemType"></span></div>
          <label class="designer-menu-field">Caption
            <input id="designerMenuItemCaption" type="text" autocomplete="off">
          </label>
          <label class="designer-menu-field">Name
            <input id="designerMenuItemId" type="text" autocomplete="off" spellcheck="false">
          </label>
          <label class="designer-menu-field">Shortcut
            <input id="designerMenuShortcut" type="text" autocomplete="off" spellcheck="false" placeholder="Primary+S or F1">
          </label>
          <label class="designer-menu-field">Enabled state
            <select id="designerMenuEnabled"></select>
          </label>
          <label class="designer-menu-field">Checked state
            <select id="designerMenuChecked"></select>
          </label>
          <div class="designer-menu-actions designer-menu-property-actions">
            <button id="designerMenuApplyItem" class="secondary" type="button">Apply item</button>
            <button id="designerMenuHandler" class="secondary" type="button">OnClick</button>
            <button id="designerMenuSource" class="secondary" type="button">Source</button>
          </div>
          <p id="designerMenuStatus" class="designer-menu-status" role="status" aria-live="polite"></p>
        </section>
      </div>
    </form>`;

  shell.querySelector('#designerMenuList').addEventListener('change', event => {
    selectedMenuIndex = Number(event.target.value) || 0;
    selectedEntryIndex = 0;
    renderDialog();
  });
  shell.querySelector('#designerMenuEntries').addEventListener('change', event => {
    selectedEntryIndex = Number(event.target.value) || 0;
    renderItemProperties();
  });
  shell.querySelector('#designerMenuAdd').addEventListener('click', addMenu);
  shell.querySelector('#designerMenuDelete').addEventListener('click', deleteMenu);
  shell.querySelector('#designerMenuApply').addEventListener('click', applyMenu);
  shell.querySelector('#designerMenuAddItem').addEventListener('click', addItem);
  shell.querySelector('#designerMenuAddSeparator').addEventListener('click', addSeparator);
  shell.querySelector('#designerMenuEarlier').addEventListener('click', () => moveItem('earlier'));
  shell.querySelector('#designerMenuLater').addEventListener('click', () => moveItem('later'));
  shell.querySelector('#designerMenuDeleteEntry').addEventListener('click', deleteEntry);
  shell.querySelector('#designerMenuApplyItem').addEventListener('click', applyItem);
  shell.querySelector('#designerMenuHandler').addEventListener('click', openHandler);
  shell.querySelector('#designerMenuSource').addEventListener('click', revealSelectedSource);
  shell.addEventListener('close', () => clearStatus());
  shell.addEventListener('keydown', event => {
    if (!(event.ctrlKey || event.metaKey) || event.key !== 'Enter') return;
    if (event.target?.closest?.('.designer-menu-properties')) {
      event.preventDefault();
      applyItem();
    }
  });
  return shell;
}

function openMenuDesigner(event) {
  event?.preventDefault?.();
  selectedMenuIndex = 0;
  selectedEntryIndex = 0;
  renderDialog();
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

function syncIfOpen() {
  if (!dialog?.open) return;
  queueMicrotask(renderDialog);
}

function renderDialog() {
  if (!dialog || !code) return;
  const windowIndex = activeFormIndex();
  let menus = [];
  try { menus = listDesignerMenus(code.value, windowIndex); }
  catch (error) { return showStatus(error); }

  selectedMenuIndex = clamp(selectedMenuIndex, 0, Math.max(0, menus.length - 1));
  const menu = menus[selectedMenuIndex] ?? null;
  const list = dialog.querySelector('#designerMenuList');
  list.replaceChildren();
  menus.forEach((item, index) => {
    const option = doc.createElement('option');
    option.value = String(index);
    option.textContent = displayDesignerExpression(item.titleExpr) || `Menu ${index + 1}`;
    option.selected = index === selectedMenuIndex;
    list.appendChild(option);
  });
  if (!menus.length) {
    const option = doc.createElement('option');
    option.textContent = 'No menus yet';
    option.disabled = true;
    option.selected = true;
    list.appendChild(option);
  }

  dialog.querySelector('#designerMenuFormLabel').textContent = `Form ${windowIndex + 1}`;
  const menuCaption = dialog.querySelector('#designerMenuCaption');
  menuCaption.disabled = !menu;
  menuCaption.value = menu ? displayDesignerExpression(menu.titleExpr) : '';
  menuCaption.dataset.sourceExpr = menu?.titleExpr ?? '';
  dialog.querySelector('#designerMenuApply').disabled = !menu;
  dialog.querySelector('#designerMenuDelete').disabled = !menu;
  dialog.querySelector('#designerMenuAddItem').disabled = !menu;
  dialog.querySelector('#designerMenuAddSeparator').disabled = !menu;

  renderEntries(menu);
  clearStatus();
}

function renderEntries(menu) {
  const list = dialog.querySelector('#designerMenuEntries');
  list.replaceChildren();
  const entries = menu?.entries ?? [];
  selectedEntryIndex = clamp(selectedEntryIndex, 0, Math.max(0, entries.length - 1));
  entries.forEach((entry, index) => {
    const option = doc.createElement('option');
    option.value = String(index);
    option.selected = index === selectedEntryIndex;
    if (entry.kind === 'separator') option.textContent = '──────── separator ────────';
    else {
      const caption = displayDesignerExpression(entry.textExpr) || entry.id || `Item ${index + 1}`;
      const shortcut = displayDesignerExpression(entry.shortcutExpr);
      option.textContent = `${caption}${shortcut ? `\t${shortcut}` : ''}`;
    }
    list.appendChild(option);
  });
  dialog.querySelector('#designerMenuEntryCount').textContent = `${entries.length} entries`;
  renderItemProperties();
}

function renderItemProperties() {
  const { menu, entry } = currentSelection();
  const isItem = entry?.kind === 'item';
  const caption = dialog.querySelector('#designerMenuItemCaption');
  const id = dialog.querySelector('#designerMenuItemId');
  const shortcut = dialog.querySelector('#designerMenuShortcut');
  const enabled = dialog.querySelector('#designerMenuEnabled');
  const checked = dialog.querySelector('#designerMenuChecked');
  for (const field of [caption, id, shortcut, enabled, checked]) field.disabled = !isItem;

  caption.value = isItem ? displayDesignerExpression(entry.textExpr) : '';
  caption.dataset.sourceExpr = isItem ? entry.textExpr ?? '' : '';
  id.value = isItem ? entry.id ?? '' : '';
  shortcut.value = isItem ? displayDesignerExpression(entry.shortcutExpr) : '';
  shortcut.dataset.sourceExpr = isItem ? entry.shortcutExpr ?? '' : '';
  fillStateSelect(enabled, isItem ? entry.enabledState : null);
  fillStateSelect(checked, isItem ? entry.checkedState : null);

  dialog.querySelector('#designerMenuItemType').textContent = entry ? (isItem ? 'MenuItem' : 'Separator') : '';
  dialog.querySelector('#designerMenuApplyItem').disabled = !isItem;
  dialog.querySelector('#designerMenuHandler').disabled = !isItem;
  dialog.querySelector('#designerMenuSource').disabled = !entry && !menu;
  dialog.querySelector('#designerMenuDeleteEntry').disabled = !entry;
  dialog.querySelector('#designerMenuEarlier').disabled = !isItem || !canMove(menu, entry, -1);
  dialog.querySelector('#designerMenuLater').disabled = !isItem || !canMove(menu, entry, 1);
}

function addMenu() {
  mutate(() => {
    const result = addDesignerMenu(code.value, activeFormIndex());
    const nextMenus = listDesignerMenus(result.source, activeFormIndex());
    selectedMenuIndex = Math.max(0, nextMenus.length - 1);
    selectedEntryIndex = 0;
    return result.source;
  }, 'Added a source-backed menu.');
}

function deleteMenu() {
  const { menu } = currentSelection();
  if (!menu) return;
  if (!globalThis.confirm?.(`Delete menu ${displayDesignerExpression(menu.titleExpr) || selectedMenuIndex + 1} and its item handlers?`)) return;
  mutate(() => {
    const next = removeDesignerMenu(code.value, menu);
    selectedMenuIndex = Math.max(0, selectedMenuIndex - 1);
    selectedEntryIndex = 0;
    return next;
  }, 'Deleted menu and matching item handlers.');
}

function applyMenu() {
  const { menu } = currentSelection();
  if (!menu) return;
  const input = dialog.querySelector('#designerMenuCaption');
  mutate(() => updateDesignerMenu(code.value, menu, {
    titleExpr: designerLiteralExpression(input.value, input.dataset.sourceExpr || menu.titleExpr)
  }), 'Updated menu caption in Patch source.');
}

function addItem() {
  const { menu } = currentSelection();
  if (!menu) return;
  mutate(() => {
    const result = addDesignerMenuItem(code.value, menu);
    const updated = listDesignerMenus(result.source, activeFormIndex())[selectedMenuIndex];
    selectedEntryIndex = Math.max(0, (updated?.entries.length ?? 1) - 1);
    return result.source;
  }, 'Added menu item.');
}

function addSeparator() {
  let { menu, entry } = currentSelection();
  if (!menu) return;
  mutate(() => {
    let source = code.value;
    let workingMenu = menu;
    let index = entry?.entryIndex ?? 0;
    if (workingMenu.entries.filter(item => item.kind === 'item').length < 2) {
      const added = addDesignerMenuItem(source, workingMenu);
      source = added.source;
      workingMenu = listDesignerMenus(source, activeFormIndex())[selectedMenuIndex];
      index = 0;
      selectedEntryIndex = Math.min(1, workingMenu.entries.length - 1);
    }
    if (!(workingMenu.entries[index]?.kind === 'item' && workingMenu.entries[index + 1]?.kind === 'item')) {
      const pair = workingMenu.entries.findIndex((item, itemIndex) =>
        item.kind === 'item' && workingMenu.entries[itemIndex + 1]?.kind === 'item'
      );
      if (pair < 0) throw new Error('No adjacent clickable items are available for another separator.');
      index = pair;
    }
    return insertDesignerMenuSeparator(source, workingMenu, index);
  }, 'Inserted separator between clickable items.');
}

function moveItem(direction) {
  const { menu, entry } = currentSelection();
  if (!menu || entry?.kind !== 'item') return;
  mutate(() => {
    const result = moveDesignerMenuItem(code.value, { ...menu, entryIndex: entry.entryIndex }, direction);
    if (result.moved && result.item) selectedEntryIndex = result.item.entryIndex;
    return result.source;
  }, direction === 'earlier' ? 'Moved item earlier.' : 'Moved item later.');
}

function deleteEntry() {
  const { menu, entry } = currentSelection();
  if (!menu || !entry) return;
  mutate(() => {
    const next = removeDesignerMenuEntry(code.value, { ...menu, entryIndex: entry.entryIndex });
    selectedEntryIndex = Math.max(0, selectedEntryIndex - 1);
    return next;
  }, entry.kind === 'separator' ? 'Deleted separator.' : 'Deleted menu item and matching handler.');
}

function applyItem() {
  const { menu, entry } = currentSelection();
  if (!menu || entry?.kind !== 'item') return;
  const caption = dialog.querySelector('#designerMenuItemCaption');
  const shortcut = dialog.querySelector('#designerMenuShortcut');
  mutate(() => {
    const result = updateDesignerMenuItem(code.value, { ...menu, entryIndex: entry.entryIndex }, {
      id: dialog.querySelector('#designerMenuItemId').value,
      textExpr: designerLiteralExpression(caption.value, caption.dataset.sourceExpr || entry.textExpr),
      shortcutExpr: shortcut.value.trim()
        ? designerLiteralExpression(shortcut.value.trim(), shortcut.dataset.sourceExpr || entry.shortcutExpr)
        : null,
      enabledState: dialog.querySelector('#designerMenuEnabled').value || null,
      checkedState: dialog.querySelector('#designerMenuChecked').value || null
    });
    return result.source;
  }, 'Updated MenuItem properties.');
}

function openHandler() {
  const { menu, entry } = currentSelection();
  if (!menu || entry?.kind !== 'item') return;
  try {
    const result = ensureDesignerMenuItemHandler(code.value, { ...menu, entryIndex: entry.entryIndex });
    if (result.source !== code.value) setSource(result.source);
    dialog.close?.();
    revealLine(result.handler?.line ?? entry.line);
  } catch (error) {
    showStatus(error);
  }
}

function revealSelectedSource() {
  const { menu, entry } = currentSelection();
  if (!menu) return;
  dialog.close?.();
  revealLine(entry?.line ?? menu.line);
}

function mutate(operation, successMessage) {
  try {
    const next = operation();
    if (typeof next !== 'string') throw new Error('Menu Designer source mutation did not return Patch source.');
    setSource(next);
    renderDialog();
    showStatus(successMessage);
  } catch (error) {
    showStatus(error);
  }
}

function currentSelection() {
  let menus = [];
  try { menus = listDesignerMenus(code?.value ?? '', activeFormIndex()); }
  catch { return { menu: null, entry: null }; }
  const menu = menus[selectedMenuIndex] ?? null;
  const entry = menu?.entries[selectedEntryIndex] ?? null;
  return { menu, entry };
}

function fillStateSelect(select, value) {
  if (!select) return;
  const names = listDesignerBooleanState(code?.value ?? '');
  if (value && !names.includes(value)) names.push(value);
  select.replaceChildren();
  const none = doc.createElement('option');
  none.value = '';
  none.textContent = '(none)';
  select.appendChild(none);
  for (const name of names) {
    const option = doc.createElement('option');
    option.value = name;
    option.textContent = name;
    option.selected = name === value;
    select.appendChild(option);
  }
  select.value = value ?? '';
}

function canMove(menu, entry, delta) {
  if (!menu || entry?.kind !== 'item') return false;
  const items = menu.entries.filter(item => item.kind === 'item');
  const index = items.findIndex(item => item.entryIndex === entry.entryIndex);
  return index >= 0 && index + delta >= 0 && index + delta < items.length;
}

function activeFormIndex() {
  const value = Number(doc?.querySelector('#patchFormSelect')?.value);
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function setSource(source) {
  code.value = source;
  code.dispatchEvent(new Event('input', { bubbles: true }));
  code.dispatchEvent(new Event('change', { bubbles: true }));
}

function revealLine(line) {
  const lines = code.value.replace(/\r\n/g, '\n').split('\n');
  let start = 0;
  for (let index = 0; index < line - 1; index += 1) start += (lines[index]?.length ?? 0) + 1;
  const end = start + (lines[line - 1]?.length ?? 0);
  code.focus();
  code.setSelectionRange(start, end);
  code.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
}

function showStatus(value) {
  const target = dialog?.querySelector('#designerMenuStatus');
  if (!target) return;
  target.textContent = value instanceof Error ? value.message : String(value ?? '');
  target.classList.toggle('is-error', value instanceof Error);
}

function clearStatus() {
  const target = dialog?.querySelector('#designerMenuStatus');
  if (!target) return;
  target.textContent = '';
  target.classList.remove('is-error');
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function installStylesheet() {
  if (doc.querySelector('link[data-patch-menu-designer]')) return;
  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.href = './designer-menu-designer.css';
  link.dataset.patchMenuDesigner = '1';
  doc.head.appendChild(link);
}
