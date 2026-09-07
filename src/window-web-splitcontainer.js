export const PATCH_WINDOW_WEB_SPLITCONTAINER_VERSION = '0.1';

const MIN_RATIO = 10;
const MAX_RATIO = 90;
const KEYBOARD_STEP = 2;

export function enhanceStandaloneWindowSplitContainers(built) {
  if (!built || typeof built.html !== 'string' || built.metadata?.projectKind !== 'window') return built;
  const descriptors = collectSplitContainerDescriptors(built.compiled?.ast ?? []);
  if (!Object.keys(descriptors).length) return built;

  const html = built.html
    .replace('</head>', `${splitContainerStyle()}\n</head>`)
    .replace('</body>', `${splitContainerRuntime(descriptors)}\n</body>`);

  return {
    ...built,
    html,
    metadata: {
      ...built.metadata,
      splitContainerStage: 1,
      splitContainerVersion: PATCH_WINDOW_WEB_SPLITCONTAINER_VERSION,
      splitContainerMode: 'source-backed-panel-two-pane',
      splitContainerResizeState: 'transient-runtime-only'
    }
  };
}

export function collectSplitContainerDescriptors(nodes, out = {}) {
  for (const node of nodes ?? []) {
    if (node?.kind === 'uiControl' && node.control === 'panel') {
      if (node.panelSplit) {
        if (!node.id) throw new Error('SplitContainer Stage 1 needs a named Panel so transient divider state has a stable UI identity.');
        out[node.id] = Object.freeze({
          orientation: node.panelSplit.orientation,
          ratio: Number(node.panelSplit.ratio),
          panes: Object.freeze((node.body ?? []).map(child => Number(child.splitPane)))
        });
      }
      collectSplitContainerDescriptors(node.body, out);
      continue;
    }
    if (node?.kind === 'window') {
      collectSplitContainerDescriptors(node.body, out);
      continue;
    }
    if (node?.kind === 'tabs') {
      for (const page of node.body ?? []) collectSplitContainerDescriptors(page.body, out);
    }
  }
  return Object.freeze(out);
}

function splitContainerStyle() {
  return `<style data-patch-window-splitcontainer>
.patch-splitcontainer>.patch-panel-surface{overflow:hidden!important}.patch-split-root{--patch-split-ratio:50;position:relative;width:100%;height:100%;min-width:0;min-height:0;overflow:hidden}.patch-split-pane{position:absolute;min-width:0;min-height:0;overflow:hidden}.patch-split-pane-flow{display:flex;flex-direction:column;align-items:flex-start;gap:10px;width:100%;height:100%;min-width:0;min-height:0;overflow:auto;padding:12px;box-sizing:border-box}.patch-split-pane-flow>.text{font-size:14px}.patch-split-pane-flow>.patch-slider,.patch-split-pane-flow>input,.patch-split-pane-flow>textarea,.patch-split-pane-flow>select,.patch-split-pane-flow>.patch-radio-group{width:100%;min-width:0}.patch-split-divider{position:absolute;z-index:3;display:grid;place-items:center;padding:0;border:0;background:transparent;touch-action:none;user-select:none}.patch-split-divider::before{content:"";display:block;border-radius:999px;background:#a1a1aa;opacity:.72}.patch-split-divider:focus-visible{outline:3px solid #2563eb;outline-offset:-2px}.patch-split-root[data-orientation="vertical"]>.patch-split-pane-1{left:0;top:0;bottom:0;width:calc(var(--patch-split-ratio) * 1% - 4px)}.patch-split-root[data-orientation="vertical"]>.patch-split-pane-2{left:calc(var(--patch-split-ratio) * 1% + 4px);right:0;top:0;bottom:0}.patch-split-root[data-orientation="vertical"]>.patch-split-divider{left:calc(var(--patch-split-ratio) * 1% - 4px);top:0;bottom:0;width:8px;cursor:col-resize}.patch-split-root[data-orientation="vertical"]>.patch-split-divider::before{width:2px;height:40px}.patch-split-root[data-orientation="horizontal"]>.patch-split-pane-1{left:0;right:0;top:0;height:calc(var(--patch-split-ratio) * 1% - 4px)}.patch-split-root[data-orientation="horizontal"]>.patch-split-pane-2{left:0;right:0;top:calc(var(--patch-split-ratio) * 1% + 4px);bottom:0}.patch-split-root[data-orientation="horizontal"]>.patch-split-divider{left:0;right:0;top:calc(var(--patch-split-ratio) * 1% - 4px);height:8px;cursor:row-resize}.patch-split-root[data-orientation="horizontal"]>.patch-split-divider::before{width:40px;height:2px}@media(prefers-color-scheme:dark){.patch-split-divider::before{background:#71717a}}@media(forced-colors:active){.patch-split-divider::before{background:CanvasText}.patch-split-divider:focus-visible{outline-color:Highlight}}
</style>`;
}

function splitContainerRuntime(descriptors) {
  const descriptorJson = JSON.stringify(descriptors).replace(/</g, '\\u003c');
  return `<script data-patch-window-splitcontainer>
(function(){
  if(typeof renderControl!=='function'||typeof render!=='function')return;
  const PATCH_SPLITCONTAINERS=Object.freeze(${descriptorJson});
  const patchSplitOriginalRenderControl=renderControl;
  const patchSplitRatios=new Map();
  const PATCH_SPLIT_MIN=10;
  const PATCH_SPLIT_MAX=90;
  const PATCH_SPLIT_KEY_STEP=2;

  function patchSplitClamp(value){
    const number=Number(value);
    if(!Number.isFinite(number))return 50;
    return Math.max(PATCH_SPLIT_MIN,Math.min(PATCH_SPLIT_MAX,number));
  }

  function patchSplitApply(root,divider,ratio,key){
    const next=patchSplitClamp(ratio);
    root.style.setProperty('--patch-split-ratio',String(next));
    divider.setAttribute('aria-valuenow',String(Math.round(next)));
    patchSplitRatios.set(key,next);
    return next;
  }

  function patchSplitPointerRatio(root,event,orientation){
    const rect=root.getBoundingClientRect();
    if(orientation==='horizontal'){
      if(!(rect.height>0))return 50;
      return ((Number(event.clientY)-rect.top)/rect.height)*100;
    }
    if(!(rect.width>0))return 50;
    return ((Number(event.clientX)-rect.left)/rect.width)*100;
  }

  function patchSplitInstallDivider(root,divider,descriptor,key){
    const orientation=descriptor.orientation==='horizontal'?'horizontal':'vertical';
    divider.tabIndex=0;
    divider.setAttribute('role','separator');
    divider.setAttribute('aria-orientation',orientation);
    divider.setAttribute('aria-valuemin',String(PATCH_SPLIT_MIN));
    divider.setAttribute('aria-valuemax',String(PATCH_SPLIT_MAX));
    divider.setAttribute('aria-label','Resize '+orientation+' split');
    patchSplitApply(root,divider,patchSplitRatios.get(key)??descriptor.ratio,key);

    let pointerId=null;
    const move=event=>{
      if(pointerId===null||event.pointerId!==pointerId)return;
      patchSplitApply(root,divider,patchSplitPointerRatio(root,event,orientation),key);
    };
    const finish=event=>{
      if(pointerId===null||event.pointerId!==pointerId)return;
      try{divider.releasePointerCapture?.(pointerId);}catch{}
      pointerId=null;
    };
    divider.addEventListener('pointerdown',event=>{
      if(event.button!==undefined&&event.button!==0)return;
      event.preventDefault();
      pointerId=event.pointerId;
      try{divider.setPointerCapture?.(pointerId);}catch{}
      patchSplitApply(root,divider,patchSplitPointerRatio(root,event,orientation),key);
    });
    divider.addEventListener('pointermove',move);
    divider.addEventListener('pointerup',finish);
    divider.addEventListener('pointercancel',finish);
    divider.addEventListener('keydown',event=>{
      const vertical=orientation==='vertical';
      const decrease=(vertical&&event.key==='ArrowLeft')||(!vertical&&event.key==='ArrowUp');
      const increase=(vertical&&event.key==='ArrowRight')||(!vertical&&event.key==='ArrowDown');
      if(!decrease&&!increase&&event.key!=='Home'&&event.key!=='End')return;
      event.preventDefault();
      const current=Number(divider.getAttribute('aria-valuenow'))||descriptor.ratio;
      const step=event.shiftKey?10:PATCH_SPLIT_KEY_STEP;
      const next=event.key==='Home'?PATCH_SPLIT_MIN:event.key==='End'?PATCH_SPLIT_MAX:current+(increase?step:-step);
      patchSplitApply(root,divider,next,key);
    });
  }

  function patchSplitPanel(control,windowId,controlIndex,descriptor){
    const panel=patchSplitOriginalRenderControl(control,windowId,controlIndex);
    if(!panel)return panel;
    const surface=panel.querySelector?.(':scope > .patch-panel-surface');
    const flow=surface?.querySelector?.(':scope > .patch-panel-flow');
    if(!surface||!flow)throw new PatchAppError("SplitContainer '"+String(control?.id||'?')+"' cannot find the Panel flow surface.");
    const rendered=[...flow.children];
    if(rendered.length!==(descriptor.panes||[]).length){
      throw new PatchAppError("SplitContainer '"+String(control?.id||'?')+"' rendered "+rendered.length+' children for '+descriptor.panes.length+' source pane entries.');
    }

    panel.classList.add('patch-splitcontainer');
    panel.dataset.patchPanelSplit=descriptor.orientation+':'+descriptor.ratio;
    surface.replaceChildren();
    const root=document.createElement('div');
    root.className='patch-split-root';
    root.dataset.orientation=descriptor.orientation;
    const pane1=document.createElement('div');
    pane1.className='patch-split-pane patch-split-pane-1';
    pane1.setAttribute('role','group');
    pane1.setAttribute('aria-label','Pane 1');
    const pane1Flow=document.createElement('div');
    pane1Flow.className='patch-split-pane-flow';
    pane1.appendChild(pane1Flow);
    const pane2=document.createElement('div');
    pane2.className='patch-split-pane patch-split-pane-2';
    pane2.setAttribute('role','group');
    pane2.setAttribute('aria-label','Pane 2');
    const pane2Flow=document.createElement('div');
    pane2Flow.className='patch-split-pane-flow';
    pane2.appendChild(pane2Flow);
    rendered.forEach((child,index)=>(Number(descriptor.panes[index])===2?pane2Flow:pane1Flow).appendChild(child));
    const divider=document.createElement('div');
    divider.className='patch-split-divider';
    root.append(pane1,divider,pane2);
    surface.appendChild(root);
    const key=String(windowId)+':'+String(control.id||controlIndex);
    patchSplitInstallDivider(root,divider,descriptor,key);
    return panel;
  }

  renderControl=function(control,windowId,controlIndex){
    const descriptor=control?.type==='panel'?PATCH_SPLITCONTAINERS[String(control?.id||'')]:null;
    if(descriptor)return patchSplitPanel(control,windowId,controlIndex,descriptor);
    return patchSplitOriginalRenderControl(control,windowId,controlIndex);
  };

  render();
})();
</script>`;
}
