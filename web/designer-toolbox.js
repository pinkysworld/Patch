const doc = typeof document === 'undefined' ? null : document;
const designer = doc?.querySelector('#designer') ?? null;
const toolbar = doc?.querySelector('#designer .designer-toolbar') ?? null;

export const DESIGNER_TOOL_CATALOG = Object.freeze([
  { group: 'Basic', type: 'text', buttonId: 'addText', label: 'Text' },
  { group: 'Basic', type: 'button', buttonId: 'addButton', label: 'Button' },
  { group: 'Basic', type: 'input', buttonId: 'addInput', label: 'Input' },
  { group: 'Basic', type: 'checkbox', buttonId: 'addCheckbox', label: 'Checkbox' },
  { group: 'Choices', type: 'radio', buttonId: 'addRadio', label: 'Radio group' },
  { group: 'Choices', type: 'combo', buttonId: 'addCombo', label: 'ComboBox' },
  { group: 'Choices', type: 'listbox', buttonId: 'addListbox', label: 'ListBox' },
  { group: 'Choices', type: 'slider', buttonId: 'addSlider', label: 'Slider' },
  { group: 'Data', type: 'table', buttonId: 'addTable', label: 'Table' },
  { group: 'Data', type: 'tree', buttonId: 'addTree', label: 'TreeView' },
  { group: 'Containers', type: 'tabs', buttonId: 'addTabs', label: 'Tabs' }
]);

if (doc) queueMicrotask(install);

export function groupedDesignerTools(catalog = DESIGNER_TOOL_CATALOG) {
  const groups = new Map();
  for (const tool of catalog) {
    if (!groups.has(tool.group)) groups.set(tool.group, []);
    groups.get(tool.group).push(tool);
  }
  return [...groups].map(([group, tools]) => ({ group, tools: [...tools] }));
}

export function filterDesignerTools(query, catalog = DESIGNER_TOOL_CATALOG) {
  const needle = String(query ?? '').trim().toLocaleLowerCase();
  if (!needle) return [...catalog];
  return catalog.filter(tool => [tool.label, tool.type, tool.group]
    .some(value => String(value).toLocaleLowerCase().includes(needle)));
}

function install() {
  if (!designer || !toolbar || designer.dataset.patchToolboxPicker === 'true') return;
  designer.dataset.patchToolboxPicker = 'true';
  installStylesheet();

  const shell = doc.createElement('div');
  shell.className = 'designer-component-palette';
  shell.setAttribute('aria-label', 'Component palette');

  const searchLabel = doc.createElement('label');
  searchLabel.className = 'designer-component-search';
  searchLabel.innerHTML = '<span>Components</span>';
  const search = doc.createElement('input');
  search.id = 'designerComponentSearch';
  search.type = 'search';
  search.placeholder = 'Search controls…';
  search.autocomplete = 'off';
  search.spellcheck = false;
  search.setAttribute('aria-label', 'Search Designer controls');
  search.title = 'Search the source-backed Component Palette (Ctrl/Cmd+Shift+A)';
  searchLabel.appendChild(search);

  const picker = doc.createElement('label');
  picker.className = 'designer-add-control-picker';
  picker.innerHTML = '<span>Add</span>';
  const select = doc.createElement('select');
  select.id = 'designerAddControl';
  select.setAttribute('aria-label', 'Add control to active Form');
  select.title = 'Add a source-backed control to the active Form';
  picker.appendChild(select);

  const count = doc.createElement('span');
  count.id = 'designerComponentCount';
  count.className = 'designer-component-count';
  count.setAttribute('aria-live', 'polite');

  shell.append(searchLabel, picker, count);

  const context = toolbar.querySelector('.designer-context-group');
  toolbar.insertBefore(shell, context ?? toolbar.firstElementChild?.nextSibling ?? null);

  const render = () => renderToolOptions(select, filterDesignerTools(search.value), count);
  render();

  search.addEventListener('input', render);
  search.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      select.focus();
      return;
    }
    if (event.key !== 'Enter') return;
    const matches = filterDesignerTools(search.value);
    if (matches.length !== 1) return;
    event.preventDefault();
    activateTool(matches[0].buttonId);
    search.select();
  });

  select.addEventListener('change', () => {
    const buttonId = select.value;
    select.value = '';
    if (!buttonId) return;
    activateTool(buttonId);
  });

  doc.addEventListener('keydown', event => {
    if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.key.toLowerCase() !== 'a') return;
    if (!designer || designer.hidden) return;
    event.preventDefault();
    search.focus();
    search.select();
  });
}

function renderToolOptions(select, tools, count) {
  select.replaceChildren();
  const prompt = doc.createElement('option');
  prompt.value = '';
  prompt.textContent = tools.length ? 'Choose…' : 'No matches';
  select.appendChild(prompt);
  for (const { group, tools: grouped } of groupedDesignerTools(tools)) {
    const optgroup = doc.createElement('optgroup');
    optgroup.label = group;
    for (const tool of grouped) {
      const option = doc.createElement('option');
      option.value = tool.buttonId;
      option.textContent = tool.label;
      optgroup.appendChild(option);
    }
    select.appendChild(optgroup);
  }
  if (count) count.textContent = `${tools.length}/${DESIGNER_TOOL_CATALOG.length}`;
}

function activateTool(buttonId) {
  const button = doc.getElementById(buttonId);
  if (!button || !toolbar.contains(button) || button.disabled) return false;
  button.click();
  return true;
}

function installStylesheet() {
  if (doc.querySelector('link[data-patch-designer-toolbox]')) return;
  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.href = './designer-toolbox.css';
  link.dataset.patchDesignerToolbox = '1';
  doc.head.appendChild(link);
}
