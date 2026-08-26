export const PATCH_WINDOW_WEB_ACCESSIBILITY_VERSION = '0.3';

export function enhanceStandaloneWindowWebApp(built) {
  if (!built || typeof built.html !== 'string' || built.metadata?.projectKind !== 'window') return built;
  const slider = containsControl(built.compiled?.ast ?? [], 'slider');
  const statusbar = containsControl(built.compiled?.ast ?? [], 'statusbar');
  const panel = containsControl(built.compiled?.ast ?? [], 'panel');
  const timer = containsControl(built.compiled?.ast ?? [], 'timer');
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
      ...(slider ? { sliderStage: 1, sliderMode: 'transient-number' } : {}),
      ...(statusbar ? { statusBarStage: 1, statusBarMode: 'source-backed-bottom-docked' } : {}),
      ...(panel ? { panelStage: 1, panelMode: 'source-backed-flow-group' } : {}),
      ...(timer ? { timerStage: 1, timerMode: 'browser-interval-ticked-event' } : {})
    }
  };
}

function containsControl(nodes, type) {
  for (const node of nodes ?? []) {
    if (node.kind === 'uiControl' && node.control === type) return true;
    if (node.kind === 'window' && containsControl(node.body, type)) return true;
    if (node.kind === 'tabs' && (node.body ?? []).some(page => containsControl(page.body, type))) return true;
    if (node.kind === 'uiControl' && node.control === 'panel' && containsControl(node.body, type)) return true;
  }
  return false;
}

function accessibilityStyle() {
  return `<style data-patch-window-accessibility>
:where(button,input,select,[role="tab"],[role="tabpanel"]):focus-visible{outline:3px solid #2563eb;outline-offset:3px}
.patch-radio-group{min-width:260px;margin:0;padding:10px 12px;border:1px solid #d4d4d8;border-radius:9px}.patch-radio-legend{padding:0 5px;font-size:12px;font-weight:700}.patch-radio-option{display:flex;align-items:center;gap:8px;min-height:30px;cursor:pointer}.patch-radio-option input{min-width:0!important;width:18px;height:18px;margin:0;padding:0}
.patch-slider{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:6px 12px;min-width:260px}.patch-slider input[type="range"]{grid-column:1/-1;width:100%;min-width:0;padding:0;border:0;background:transparent}.patch-slider-value{font:12px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;font-variant-numeric:tabular-nums}.patch-slider-range{font-size:11px;color:#71717a}
.patch-panel{width:100%;height:100%;min-width:0;overflow:auto;margin:0;padding:0;border:1px solid #d4d4d8;border-radius:10px;background:#fff}.patch-panel-title{padding:7px 10px;border-bottom:1px solid #e4e4e7;background:#f4f4f5;color:#52525b;font-size:11px;font-weight:750;text-transform:uppercase;letter-spacing:.04em}.patch-panel-flow{display:flex;flex-direction:column;align-items:flex-start;gap:10px;padding:12px}.patch-panel-flow>.text{font-size:14px}.patch-panel-flow>.patch-slider,.patch-panel-flow>input,.patch-panel-flow>select,.patch-panel-flow>.patch-radio-group{width:100%;min-width:0}
.patch-statusbar{display:flex;align-items:center;min-width:0;overflow:hidden;padding:0 10px;border-top:1px solid #d4d4d8;background:#f4f4f5;color:#52525b;font-size:12px;line-height:1.2;white-space:nowrap;text-overflow:ellipsis;position:absolute!important;left:0!important;right:0!important;bottom:0!important;top:auto!important;width:100%!important;max-width:none!important;margin:0!important}
@media(prefers-color-scheme:dark){.patch-radio-group{border-color:#41444e}.patch-slider-range{color:#a1a1aa}.patch-panel{border-color:#41444e;background:#1b1d22}.patch-panel-title{border-color:#34363e;background:#24262d;color:#d4d4d8}.patch-statusbar{border-color:#41444e;background:#24262d;color:#d4d4d8}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition-duration:.01ms!important;animation-duration:.01ms!important}}
@media(forced-colors:active){:where(button,input,select,[role="tab"],[role="tabpanel"]):focus-visible{outline:3px solid Highlight}.patch-radio-group,.patch-panel{border:1px solid CanvasText}.patch-slider-range{color:CanvasText}.patch-panel-title,.patch-statusbar{border-color:CanvasText;background:Canvas;color:CanvasText}}
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
  const patchOriginalControlType=typeof controlType==='function'?controlType:null;
  const patchTimerHandles=[];
  const patchWindow=typeof window==='undefined'?null:window;

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

  function patchFindControlType(nodes,id){
    for(const node of nodes||[]){
      if(node?.kind==='uiControl'){
        if(node.id===id)return node.control;
        if(node.control==='panel'){
          const nested=patchFindControlType(node.body,id);
          if(nested)return nested;
        }
      }
      if(node?.kind==='tabs'){
        for(const page of node.body||[]){const nested=patchFindControlType(page.body,id);if(nested)return nested;}
      }
      if(node?.kind==='window'){
        const nested=patchFindControlType(node.body,id);
        if(nested)return nested;
      }
    }
    return null;
  }

  function patchSliderNode(id){
    const find=nodes=>{for(const node of nodes||[]){if(node?.kind==='uiControl'&&node.control==='slider'&&node.id===id)return node;if(node?.kind==='tabs'){for(const page of node.body||[]){const nested=find(page.body);if(nested)return nested;}}if(node?.kind==='uiControl'&&node.control==='panel'){const nested=find(node.body);if(nested)return nested;}}return null;};
    for(const node of typeof PROGRAM!=='undefined'?(PROGRAM||[]):[]){if(node?.kind!=='window')continue;const slider=find(node.body);if(slider)return slider;}
    return null;
  }

  function patchWindowModels(nodes,models){
    let modelIndex=0;
    for(const node of nodes||[]){
      if(node?.kind==='uiControl'){
        const model=models?.[modelIndex++]||null;
        if(!model)continue;
        if(node.control==='slider'){
          const min=Number(node.min);const max=Number(node.max);const step=Number(node.step??1);
          model.min=min;model.max=max;model.step=step;
          const bound=node.id&&typeof state!=='undefined'&&state?.has?.(node.id)?state.get(node.id):min;
          model.value=patchClampSliderValue(model,bound);
        }
        if(node.control==='panel'){
          const nested=patchOriginalBuildUIItems?patchOriginalBuildUIItems(node.body||[]):[];
          model.controls=patchWindowModels(node.body||[],nested);
        }
        if(node.control==='timer')model.interval=Number(node.interval??1000);
        continue;
      }
      if(node?.kind==='tabs'){
        const model=models?.[modelIndex++]||null;
        const pages=node.body||[];
        pages.forEach((page,pageIndex)=>patchWindowModels(page.body,model?.pages?.[pageIndex]?.controls||[]));
      }
    }
    return models;
  }

  if(patchOriginalBuildUIItems){
    buildUIItems=function(nodes){return patchWindowModels(nodes,patchOriginalBuildUIItems(nodes));};
  }

  if(patchOriginalControlType){
    controlType=function(id){
      const direct=patchOriginalControlType(id);
      if(direct)return direct;
      return patchFindControlType(typeof PROGRAM!=='undefined'?(PROGRAM||[]):[],id);
    };
  }

  if(patchOriginalTrigger){
    trigger=function(control,event='clicked',payload={}){
      if(event==='changed'&&typeof controlType==='function'&&controlType(control)==='slider'){
        if(typeof payload?.value!=='number'||!Number.isFinite(payload.value)){
          throw new PatchAppError("The 'changed' action for slider '"+control+"' needs a finite numeric event-local value.");
        }
        const slider=patchSliderNode(control);
        if(slider&&(payload.value<Number(slider.min)||payload.value>Number(slider.max))){
          throw new PatchAppError("The 'changed' action for slider '"+control+"' needs a value from "+slider.min+' to '+slider.max+'.');
        }
      }
      return patchOriginalTrigger(control,event,payload);
    };
  }

  renderControl=function(control,windowId,controlIndex){
    if(control?.type==='timer')return null;

    if(control?.type==='panel'){
      const panel=document.createElement('section');
      panel.className='patch-panel';
      panel.setAttribute?.('role','group');
      panel.setAttribute?.('aria-label',patchControlName(control,'Panel'));
      const title=document.createElement('div');
      title.className='patch-panel-title';
      title.textContent=patchControlName(control,'Panel');
      const flow=document.createElement('div');
      flow.className='patch-panel-flow';
      (control.controls||[]).forEach((nested,index)=>{const child=renderControl(nested,windowId,index);if(child)flow.appendChild(child);});
      panel.append(title,flow);
      return panel;
    }

    if(control?.type==='statusbar'){
      const bar=document.createElement('div');
      bar.className='patch-statusbar';
      bar.setAttribute?.('role','status');
      bar.setAttribute?.('aria-label',String(control.id||'StatusBar'));
      bar.textContent=patchControlName(control,'Ready');
      return bar;
    }

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

  function patchTimerNodes(nodes,out=[]){
    for(const node of nodes||[]){
      if(node?.kind==='uiControl'&&node.control==='timer')out.push(node);
      if(node?.kind==='window'||(node?.kind==='uiControl'&&node.control==='panel'))patchTimerNodes(node.body,out);
      if(node?.kind==='tabs')for(const page of node.body||[])patchTimerNodes(page.body,out);
    }
    return out;
  }

  function patchInstallTimers(){
    if(typeof patchWindow?.setInterval!=='function'||typeof safeTrigger!=='function')return;
    const handlers=typeof events!=='undefined'?(events||[]):[];
    for(const timer of patchTimerNodes(typeof PROGRAM!=='undefined'?(PROGRAM||[]):[])){
      if(!timer.id||!handlers.some(handler=>handler.control===timer.id&&handler.event==='ticked'))continue;
      const interval=Number(timer.interval??1000);
      if(!Number.isInteger(interval)||interval<1||interval>3600000)continue;
      patchTimerHandles.push(patchWindow.setInterval(()=>safeTrigger(timer.id,'ticked'),interval));
    }
  }

  function patchClearTimers(){while(patchTimerHandles.length)patchWindow?.clearInterval?.(patchTimerHandles.pop());}

  const output=document.getElementById?.('output');
  output?.setAttribute?.('role','status');
  output?.setAttribute?.('aria-live','polite');
  output?.setAttribute?.('aria-atomic','true');
  patchWindow?.addEventListener?.('pagehide',patchClearTimers,{once:true});
  render();
  patchInstallTimers();
})();
</script>`;
}
