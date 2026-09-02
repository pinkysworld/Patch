import { addDesignerControl } from '../src/designer.js';
import { showDesignerInspectorError } from './designer-selection.js';

const code = document.querySelector('#code');
const addSlider = document.querySelector('#addSlider');

installStyles();

addSlider?.addEventListener('click', event => {
  event.preventDefault();
  event.stopImmediatePropagation();
  if (!code) return;
  try {
    const activeForm = Number(document.querySelector('#patchFormSelect')?.value) || 0;
    setSource(addDesignerControl(code.value, 'slider', { windowIndex: activeForm }));
  } catch (error) {
    showDesignerInspectorError(error);
  }
}, { capture: true });

function setSource(source) {
  code.value = source;
  code.dispatchEvent(new Event('input', { bubbles: true }));
  code.dispatchEvent(new Event('change', { bubbles: true }));
}

function installStyles() {
  if (document.querySelector('style[data-patch-slider-stage1]')) return;
  const style = document.createElement('style');
  style.dataset.patchSliderStage1 = '1';
  style.textContent = `
.patch-slider{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;min-width:180px;padding:4px 2px;color:inherit}
.patch-slider input[type="range"]{width:100%;min-width:0;accent-color:currentColor}
.patch-slider output{min-width:3.5em;text-align:right;font:600 12px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;color:inherit}
.designer-control.patch-slider{cursor:pointer}
.designer-control.patch-slider input[type="range"]{pointer-events:none}
`;
  document.head.appendChild(style);
}
