const editor = document.querySelector('#code');
const skipLink = document.querySelector('#skipToEditor');
const resultTabList = document.querySelector('#resultTabs');
const resultTabs = Array.from(resultTabList?.querySelectorAll('[role="tab"]') ?? []);
const runButton = document.querySelector('#run');
const buildButton = document.querySelector('#build');

installSkipLink();
installResultTabKeyboard();
installStudioShortcuts();
syncResultTabs();

if (resultTabList && typeof MutationObserver !== 'undefined') {
  const observer = new MutationObserver(syncResultTabs);
  observer.observe(resultTabList, { attributes: true, subtree: true, attributeFilter: ['class'] });
}

function installSkipLink() {
  skipLink?.addEventListener('click', event => {
    event.preventDefault();
    editor?.focus({ preventScroll: true });
    editor?.scrollIntoView({ block: 'center' });
  });
}

function installResultTabKeyboard() {
  resultTabList?.addEventListener('keydown', event => {
    const current = event.target?.closest?.('[role="tab"]');
    if (!current || !resultTabList.contains(current)) return;
    const index = resultTabs.indexOf(current);
    if (index < 0) return;

    let nextIndex = null;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % resultTabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + resultTabs.length) % resultTabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = resultTabs.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const next = resultTabs[nextIndex];
    next.focus();
    next.click();
    syncResultTabs();
  });
}

function installStudioShortcuts() {
  window.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.isComposing || hasOpenDialog()) return;
    const command = event.ctrlKey || event.metaKey;
    if (!command) return;

    if (event.key === 'Enter') {
      event.preventDefault();
      runButton?.click();
      return;
    }

    if (event.shiftKey && event.key.toLowerCase() === 'b') {
      event.preventDefault();
      buildButton?.click();
    }
  });
}

function syncResultTabs() {
  for (const tab of resultTabs) {
    const panelId = tab.getAttribute('aria-controls');
    const panel = panelId ? document.getElementById(panelId) : null;
    const selected = tab.classList.contains('active') && !panel?.hidden;
    tab.setAttribute('aria-selected', selected ? 'true' : 'false');
    tab.tabIndex = selected ? 0 : -1;
  }
}

function hasOpenDialog() {
  return Boolean(document.querySelector('dialog[open]'));
}
