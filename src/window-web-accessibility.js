export const PATCH_WINDOW_WEB_ACCESSIBILITY_VERSION = '0.2';

export function enhanceStandaloneWindowWebApp(built) {
  if (!built || typeof built.html !== 'string' || built.metadata?.projectKind !== 'window') return built;
  const slider = containsSlider(built.compiled?.ast ?? []);
  const html = built.html
    .replace('<pre id="output"></pre>', '<pre id="output" role="status" aria-live="polite" aria-atomic="true"></pre>')
    .replace('</head>', `${accessibilityStyle()}\n</head>`)
    .replace('</body>', `${accessibilityRuntime()}\n</body>`);
  return {
    ...built,
    html,
    metadata: {
      ...built.metadata,
      accessibilityVersion: PATCH_WINDOW_WEB_ACCESSIBILITY_VERSION,
      ...(slider ? { sliderStage: 1, sliderMode: 'transient-number' } : {})
    }
  };
}

function containsSlider(nodes) {
  for (const node of nodes ?? []) {
    if (node.kind === 'uiControl' && node.control === 'slider') return true;
    if (node.kind === 'window' && containsSlider(node.body)) return true;
    if (node.kind === 'tabs' && (node.body ?? []).some(page => containsSlider(page.body))) return true;
  }
  return false;
}

function accessibilityStyle() {
  return `<style data-patch-window-accessibility>
:where(button,input,select,[role="tab"],[role="tabpanel"]):focus-visible{outline:3px solid #2563eb;outline-offset:3px}
.patch-radio-group{min-width:260px;margin:0;padding:10px 12px;border:1px solid #d4d4d8;border-radius:9px}.patch-radio-legend{padding:0 5px;font-size:12px;font-weight:700}.patch-radio-option{display:flex;align-items:center;gap:8px;min-height:30px;cursor:pointer}.patch-radio-option input{min-width:0!important;width:18px;height:18px;margin:0;padding:0}
.patch-slider{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:6px 12px;min-width:260px}.patch-slider input[type="range"]{grid-column:1/-1;width:100%;min-width:0;padding:0;border:0;background:transparent}.patch-slider-value{font:12px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;font-variant-numeric:tabular-nums}.patch-slider-range{font-size:11px;color:#71717a}
@media(prefers-color-scheme:dark){.patch-radio-group{border-color:#41444e}.patch-slider-range{color:#a1a1aa}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition-duration:.01ms!important;animation-duration:.01ms!important}}
@media(forced-colors:active){:where(button,input,select,[role="tab"],[role="tabpanel"]):focus-visible{outline:3px solid Highlight}.patch-radio-group{border:1px solid CanvasText}.patch-slider-range{color:CanvasText}}
</style>`;
}

function accessibilityRuntime() {
  return `<script data-patch-window-accessibility>
(function(){
  if(typeof renderControl!=='function'||typeof render!=='function')return;
  const patchOriginalRenderControl=renderControl;
  const patchOriginalRender=render;
  const patchOriginalBuildUIItems=typeof buildUIItems==='function'?buildUIItems:null;
  const patchOriginalTrigger=typeof trigger==='function'?trigger:null;

  function patchControlName(control,fallback){
    const text=String(control?.text||'').trim();
    const id=String(control?.id||'').trim();
    return text||id||fallback;
  }

  function patchClampSliderValue(control,value){
    const min=Number(control?.min??0);const max=Number(control?.max??100);const fallback=min;
    const number=Number(value);if(!Number.isFinite(number))return fallback;
    return Math.min(max,Math.max(min,number));
  }

  function patchSliderModels(nodes,models){
    let modelIndex=0;
    for(const node of nodes||[]){
      if(node?.kind==='uiControl'){
        const model=models?.[modelIndex++]||null;
        if(node.control!=='slider'||!model)continue;
        const min=Number(node.min);const max=Number(node.max);const step=Number(node.step??1);
        model.min=min;model.max=max;model.step=step;
        const bound=node.id&&typeof state!=='undefined'&&state?.has?.(node.id)?state.get(node.id):min;
        model.value=patchClampSliderValue(model,bound);
        continue;
      }
      if(node?.kind==='tabs'){
        const model=models?.[modelIndex++]||null;
        const pages=node.body||[];
        pages.forEach((page,pageIndex)=>patchSliderModels(page.body,model?.pages?.[pageIndex]?.controls||[]));
      }
    }
    return models;
  }

  if(patchOriginalBuildUIItems){
    buildUIItems=function(nodes){return patchSliderModels(nodes,patchOriginalBuildUIItems(nodes));};
  }

  if(patchOriginalTrigger){
    trigger=function(control,event='clicked',payload={}){
      if(event==='changed'&&typeof controlType==='function'&&controlType(control)==='slider'){
        if(typeof payload?.value!=='number'||!Number.isFinite(payload.value)){
          throw new PatchAppError("The 'changed' action for slider '"+control+"' needs a finite numeric event-local value.");
        }
      }
      return patchOriginalTrigger(control,event,payload);
    };
  }

  renderControl=function(control,windowId,controlIndex){
    if(control?.type==='radio'){
      const group=document.createElement('fieldset');
      group.className='patch-radio-group';
      group.setAttribute?.('role','radiogroup');
      const legend=document.createElement('legend');
      const legendId='patch-radio-legend-'+windowId+'-'+(control.id||controlIndex);
      legend.id=legendId;
      legend.className='patch-radio-legend';
      legend.textContent=patchControlName(control,'Options');
      group.setAttribute?.('aria-labelledby',legendId);
      group.appendChild(legend);
      const radioName='patch-radio-'+windowId+'-'+(control.id||controlIndex);
      for(const option of control.options||[]){
        const label=document.createElement('label');
        label.className='patch-radio-option';
        const input=document.createElement('input');
        input.type='radio';
        input.name=radioName;
        input.value=option;
        input.checked=String(control.value??'')===String(option);
        const text=document.createElement('span');
        text.textContent=option;
        input.addEventListener('change',()=>{if(input.checked)safeTrigger(control.id,'changed',{value:input.value});});
        label.append(input,text);
        group.appendChild(label);
      }
      return group;
    }

    if(control?.type==='slider'){
      const wrap=document.createElement('label');
      wrap.className='patch-slider';
      const range=document.createElement('span');
      range.className='patch-slider-range';
      range.textContent=String(control.min)+' … '+String(control.max);
      const value=document.createElement('output');
      value.className='patch-slider-value';
      const input=document.createElement('input');
      input.type='range';
      input.min=String(control.min);
      input.max=String(control.max);
      input.step=String(control.step??1);
      input.value=String(patchClampSliderValue(control,control.value));
      input.setAttribute?.('aria-label',patchControlName(control,'Slider'));
      value.value=input.value;
      value.textContent=input.value;
      input.addEventListener('input',()=>{value.value=input.value;value.textContent=input.value;});
      input.addEventListener('change',()=>safeTrigger(control.id,'changed',{value:Number(input.value)}));
      wrap.append(range,value,input);
      return wrap;
    }

    const el=patchOriginalRenderControl(control,windowId,controlIndex);
    if(!el)return el;
    if(control?.type==='input')el.setAttribute?.('aria-label',patchControlName(control,'Input'));
    if(control?.type==='combo')el.setAttribute?.('aria-label',patchControlName(control,'Combo box'));
    if(control?.type==='listbox')el.setAttribute?.('aria-label',patchControlName(control,'List box'));
    return el;
  };

  render=function(){
    patchOriginalRender();
    patchEnhanceWindowAccessibility();
  };

  function patchEnhanceWindowAccessibility(){
    if(typeof document.querySelectorAll!=='function')return;
    const shells=[...document.querySelectorAll('#app .window')];
    shells.forEach((shell,windowIndex)=>{
      const title=shell.querySelector?.('header');
      if(!title)return;
      const titleId='patch-window-title-'+windowIndex;
      title.id=titleId;
      shell.setAttribute?.('role','region');
      shell.setAttribute?.('aria-labelledby',titleId);
    });

    const tabLists=[...document.querySelectorAll('.patch-tabs-list')];
    tabLists.forEach((list,listIndex)=>{
      const tabs=[...list.querySelectorAll('[role="tab"]')];
      const root=list.closest?.('.patch-tabs');
      const panel=root?.querySelector?.('.patch-tab-panel');
      if(!tabs.length||!panel)return;
      const panelId='patch-tab-panel-'+listIndex;
      panel.id=panelId;
      panel.setAttribute?.('role','tabpanel');
      panel.tabIndex=0;
      let selected=0;
      tabs.forEach((tab,index)=>{
        if(tab.getAttribute?.('aria-selected')==='true')selected=index;
        tab.id='patch-tab-'+listIndex+'-'+index;
        tab.setAttribute?.('aria-controls',panelId);
        tab.tabIndex=tab.getAttribute?.('aria-selected')==='true'?0:-1;
        if(tab.dataset?.patchA11yKeyboard!=='1'){
          if(tab.dataset)tab.dataset.patchA11yKeyboard='1';
          tab.addEventListener('keydown',event=>patchHandleTabKey(event,listIndex,index));
        }
      });
      panel.setAttribute?.('aria-labelledby','patch-tab-'+listIndex+'-'+selected);
    });
  }

  function patchHandleTabKey(event,listIndex,currentIndex){
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    const lists=[...document.querySelectorAll('.patch-tabs-list')];
    const tabs=[...(lists[listIndex]?.querySelectorAll?.('[role="tab"]')||[])];
    if(!tabs.length)return;
    event.preventDefault();
    let next=currentIndex;
    if(event.key==='ArrowLeft')next=(currentIndex-1+tabs.length)%tabs.length;
    if(event.key==='ArrowRight')next=(currentIndex+1)%tabs.length;
    if(event.key==='Home')next=0;
    if(event.key==='End')next=tabs.length-1;
    tabs[next]?.click?.();
    const rebuiltLists=[...document.querySelectorAll('.patch-tabs-list')];
    const rebuiltTabs=[...(rebuiltLists[listIndex]?.querySelectorAll?.('[role="tab"]')||[])];
    rebuiltTabs[next]?.focus?.();
  }

  const output=document.getElementById?.('output');
  output?.setAttribute?.('role','status');
  output?.setAttribute?.('aria-live','polite');
  output?.setAttribute?.('aria-atomic','true');
  render();
})();
</script>`;
}
