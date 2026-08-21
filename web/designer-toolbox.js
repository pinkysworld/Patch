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

function install() {
  if (!designer || !toolbar || designer.dataset.patchToolboxPicker === 'true') return;
  designer.dataset.patchToolboxPicker = 'true';
  installStylesheet();

  const label = doc.createElement('label');
  label.className = 'designer-add-control-picker';
  label.innerHTML = '<span>Add control</span>';
  const select = doc.createElement('select');
  select.id = 'designerAddControl';
  select.setAttribute('aria-label', 'Add control to active Form');
  select.title = 'Add a source-backed control to the active Form (Ctrl/Cmd+Shift+A focuses this list)';

  const prompt = doc.createElement('option');
  prompt.value = '';
  prompt.textContent = 'Choose…';
  select.appendChild(prompt);

  for (const { group, tools } of groupedDesignerTools()) {
    const optgroup = doc.createElement('optgroup');
    optgroup.label = group;
    for (const tool of tools) {
      const option = doc.createElement('option');
      option.value = tool.buttonId;
      option.textContent = tool.label;
      optgroup.appendChild(option);
    }
    select.appendChild(optgroup);
  }
  label.appendChild(select);

  const context = toolbar.querySelector('.designer-context-group');
  toolbar.insertBefore(label, context ?? toolbar.firstElementChild?.nextSibling ?? null);

  select.addEventListener('change', () => {
    const buttonId = select.value;
    select.value = '';
    if (!buttonId) return;
    const button = doc.getElementById(buttonId);
    if (!button || !toolbar.contains(button) || button.disabled) return;
    button.click();
  });

  doc.addEventListener('keydown', event => {
    if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.key.toLowerCase() !== 'a') return;
    if (!designer || designer.hidden) return;
    event.preventDefault();
    select.focus();
  });
}

function installStylesheet() {
  if (doc.querySelector('link[data-patch-designer-toolbox]')) return;
  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.href = './designer-toolbox.css';
  link.dataset.patchDesignerToolbox = '1';
  doc.head.appendChild(link);
}
