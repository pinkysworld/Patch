export const PATCH_WINDOW_WEB_NUMBEREDIT_VERSION = '0.1';

export function enhanceStandaloneWindowNumberEdits(built) {
  if (!built || typeof built.html !== 'string' || built.metadata?.projectKind !== 'window') return built;
  const descriptors = collectNumberEditDescriptors(built.compiled?.ast ?? []);
  if (!Object.keys(descriptors).length) return built;
  const html = built.html
    .replace('</head>', `${numberEditStyle()}\n</head>`)
    .replace('</body>', `${numberEditRuntime(descriptors)}\n</body>`);
  return {
    ...built,
    html,
    metadata: {
      ...built.metadata,
      numberEditStage: 1,
      numberEditVersion: PATCH_WINDOW_WEB_NUMBEREDIT_VERSION,
      numberEditMode: 'source-backed-number-input',
      numberEditEventValue: 'finite-number'
    }
  };
}

export function collectNumberEditDescriptors(ast) {
  const out = {};
  walk(ast, node => {
    if (node?.kind !== 'uiControl' || node.control !== 'input' || !node.id || !node.inputNumber) return;
    out[node.id] = Object.freeze({
      min: Number(node.inputNumber.min),
      max: Number(node.inputNumber.max),
      step: Number(node.inputNumber.step)
    });
  });
  return Object.freeze(out);
}

function walk(nodes, visit) {
  for (const node of nodes ?? []) {
    visit(node);
    if (node?.body) walk(node.body, visit);
    if (node?.thenBody) walk(node.thenBody, visit);
    if (node?.elseBody) walk(node.elseBody, visit);
  }
}

function numberEditStyle() {
  return `<style data-patch-window-numberedit>
.patch-numberedit{font-variant-numeric:tabular-nums}.patch-numberedit:invalid{outline:2px solid #b91c1c;outline-offset:1px}
@media(forced-colors:active){.patch-numberedit:invalid{outline:2px solid Mark}}
</style>`;
}

function numberEditRuntime(descriptors) {
  const json = JSON.stringify(descriptors).replace(/</g, '\\u003c');
  return `<script data-patch-window-numberedit>
(function(){
  if(typeof renderControl!=='function'||typeof render!=='function'||typeof safeTrigger!=='function')return;
  const PATCH_NUMBEREDITS=Object.freeze(${json});
  const patchNumberOriginalRenderControl=renderControl;
  const patchNumberOriginalSafeTrigger=safeTrigger;

  function patchNumberDescriptor(id){return PATCH_NUMBEREDITS[String(id||'')]||null;}
  function patchNumberValue(descriptor,value){
    if(value===''||value===null||value===undefined)throw new PatchAppError('NumberEdit changed(value) needs a finite number.');
    const number=Number(value);
    if(!Number.isFinite(number))throw new PatchAppError('NumberEdit changed(value) needs a finite number.');
    if(number<descriptor.min||number>descriptor.max)throw new PatchAppError('NumberEdit changed(value) must stay between '+descriptor.min+' and '+descriptor.max+'.');
    return number;
  }

  safeTrigger=function(control,event='clicked',payload={}){
    const descriptor=event==='changed'?patchNumberDescriptor(control):null;
    if(descriptor)payload={...payload,value:patchNumberValue(descriptor,payload?.value)};
    return patchNumberOriginalSafeTrigger(control,event,payload);
  };

  renderControl=function(control,windowId,controlIndex){
    const element=patchNumberOriginalRenderControl(control,windowId,controlIndex);
    const descriptor=control?.type==='input'?patchNumberDescriptor(control?.id):null;
    if(!descriptor||element?.tagName!=='INPUT')return element;
    element.type='number';
    element.classList.add('patch-numberedit');
    element.min=String(descriptor.min);
    element.max=String(descriptor.max);
    element.step=String(descriptor.step);
    element.inputMode='decimal';
    element.dataset.patchNumberEdit='true';
    element.setAttribute('aria-label',String(control?.id||'NumberEdit'));
    return element;
  };

  render();
})();
</script>`;
}
