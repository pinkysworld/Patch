import './studio-build-readiness.js';

const code = document.querySelector('#code');
const projectKind = document.querySelector('#projectKind');

let sourceSignals = 0;
let kindSignals = 0;

code?.addEventListener('input', () => { sourceSignals += 1; });
code?.addEventListener('change', () => { sourceSignals += 1; });
projectKind?.addEventListener('change', () => { kindSignals += 1; });

for (const type of ['click', 'change']) {
  document.addEventListener(type, captureProgrammaticMutation, { capture: true });
}

function captureProgrammaticMutation() {
  if (!code || !projectKind) return;
  const beforeSource = code.value;
  const beforeKind = projectKind.value;
  const beforeSourceSignals = sourceSignals;
  const beforeKindSignals = kindSignals;

  queueMicrotask(() => {
    if (code.value !== beforeSource && sourceSignals === beforeSourceSignals) {
      code.dispatchEvent(new Event('input', { bubbles: true }));
      code.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (projectKind.value !== beforeKind && kindSignals === beforeKindSignals) {
      projectKind.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
}
