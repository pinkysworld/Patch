import { patchInputMaskInputMode, patchInputMaskPlaceholder } from './input-presentation.js';

export const PATCH_WINDOW_WEB_PAINTBOX_VERSION = '0.1';
export const PATCH_WINDOW_WEB_PASSWORD_EDIT_VERSION = '0.1';
export const PATCH_WINDOW_WEB_MASKED_EDIT_VERSION = '0.1';

const DEFAULT_WIDTH = 320;
const DEFAULT_HEIGHT = 200;

/**
 * Add the Stage 1 PaintBox Canvas2D renderer and final browser-only Window
 * presentation enhancements to a generated standalone Window app.
 *
 * The PaintBox renderer is deliberately ephemeral. It rebuilds pixels from
 * visible Patch source every time the ordinary Window runtime renders.
 * Persistent application state remains exclusively in Patch state and can only
 * change through `change`.
 */
export function enhanceStandaloneWindowPaintBoxes(built) {
  if (!built || typeof built.html !== 'string' || built.metadata?.projectKind !== 'window') return built;
  const ast = built.compiled?.ast ?? [];
  const descriptors = collectPaintBoxDescriptors(ast);
  const passwordInputIds = collectPasswordInputIds(ast);
  const maskedInputs = collectMaskedInputDescriptors(ast);
  const hasPaintBoxes = Object.keys(descriptors).length > 0;
  const hasPasswordEdits = passwordInputIds.length > 0;
  const hasMaskedEdits = Object.keys(maskedInputs).length > 0;
  if (!hasPaintBoxes && !hasPasswordEdits && !hasMaskedEdits) return built;

  let html = built.html;
  if (hasPaintBoxes) {
    html = html
      .replace('</head>', `${paintBoxStyle()}\n</head>`)
      .replace('</body>', `${paintBoxRuntime(descriptors)}\n</body>`);
  }
  if (hasPasswordEdits) html = html.replace('</body>', `${passwordEditRuntime(passwordInputIds)}\n</body>`);
  if (hasMaskedEdits) html = html.replace('</body>', `${maskedEditRuntime(maskedInputs)}\n</body>`);

  return {
    ...built,
    html,
    metadata: {
      ...built.metadata,
      ...(hasPaintBoxes ? {
        paintBoxStage: 1,
        paintBoxVersion: PATCH_WINDOW_WEB_PAINTBOX_VERSION,
        paintBoxMode: 'pure-source-backed-canvas2d',
        paintBoxCoordinates: 'source-control-logical-size'
      } : {}),
      ...(hasPasswordEdits ? {
        passwordEditStage: 1,
        passwordEditVersion: PATCH_WINDOW_WEB_PASSWORD_EDIT_VERSION,
        passwordEditMode: 'source-backed-masked-input'
      } : {}),
      ...(hasMaskedEdits ? {
        maskedEditStage: 1,
        maskedEditVersion: PATCH_WINDOW_WEB_MASKED_EDIT_VERSION,
        maskedEditMode: 'source-backed-token-mask',
        maskedEditTokens: '0=digit,A=letter,*=alphanumeric'
      } : {})
    }
  };
}

export function collectPaintBoxDescriptors(ast) {
  const controls = new Map();
  const handlers = new Map();

  walk(ast, node => {
    if (node.kind === 'uiControl' && node.control === 'paintbox' && node.id) {
      controls.set(node.id, {
        width: positiveDimension(node.layout?.width, DEFAULT_WIDTH),
        height: positiveDimension(node.layout?.height, DEFAULT_HEIGHT),
        line: node.line ?? null
      });
    }
    if (node.kind === 'event' && node.event === 'paint' && node.control) {
      const previous = handlers.get(node.control) ?? [];
      handlers.set(node.control, [...previous, ...clonePaintNodes(node.body ?? [])]);
    }
  });

  const descriptors = {};
  for (const [id, control] of controls) {
    descriptors[id] = Object.freeze({
      width: control.width,
      height: control.height,
      line: control.line,
      body: Object.freeze(handlers.get(id) ?? [])
    });
  }
  return Object.freeze(descriptors);
}

export function collectPasswordInputIds(ast) {
  const ids = [];
  walk(ast, node => {
    if (
      node.kind === 'uiControl' &&
      node.control === 'input' &&
      node.inputPresentation === 'password' &&
      node.id
    ) ids.push(node.id);
  });
  return ids;
}

export function collectMaskedInputDescriptors(ast) {
  const descriptors = {};
  walk(ast, node => {
    if (node.kind !== 'uiControl' || node.control !== 'input' || !node.id || !node.inputMask) return;
    descriptors[node.id] = Object.freeze({
      mask: node.inputMask,
      placeholder: patchInputMaskPlaceholder(node.inputMask),
      inputMode: patchInputMaskInputMode(node.inputMask)
    });
  });
  return Object.freeze(descriptors);
}

function clonePaintNodes(nodes) {
  return (nodes ?? []).map(node => {
    if (node.kind === 'drawPaint') {
      return Object.freeze({ kind: 'drawPaint', command: Object.freeze({ ...(node.command ?? {}) }), line: node.line ?? null });
    }
    if (node.kind === 'if') {
      return Object.freeze({
        kind: 'if', expr: node.expr, line: node.line ?? null,
        thenBody: Object.freeze(clonePaintNodes(node.thenBody)),
        elseBody: Object.freeze(clonePaintNodes(node.elseBody))
      });
    }
    if (node.kind === 'repeat') {
      return Object.freeze({ kind: 'repeat', expr: node.expr, line: node.line ?? null, body: Object.freeze(clonePaintNodes(node.body)) });
    }
    return Object.freeze({ kind: String(node.kind ?? 'unknown'), line: node.line ?? null });
  });
}

function walk(nodes, visit) {
  for (const node of nodes ?? []) {
    visit(node);
    if (node.body) walk(node.body, visit);
    if (node.thenBody) walk(node.thenBody, visit);
    if (node.elseBody) walk(node.elseBody, visit);
  }
}

function positiveDimension(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 16 ? Math.round(number) : fallback;
}

function paintBoxStyle() {
  return `<style data-patch-window-paintbox>
.patch-paintbox{display:block;max-width:none;max-height:none;border:1px solid #d4d4d8;border-radius:6px;background:transparent}
@media(prefers-color-scheme:dark){.patch-paintbox{border-color:#41444e}}
@media(forced-colors:active){.patch-paintbox{border:1px solid CanvasText;forced-color-adjust:auto}}
</style>`;
}

function paintBoxRuntime(descriptors) {
  const descriptorJson = JSON.stringify(descriptors).replace(/</g, '\\u003c');
  return `<script data-patch-window-paintbox>
(function(){
  if(typeof renderControl!=='function'||typeof render!=='function')return;
  const PATCH_PAINTBOX_DESCRIPTORS=Object.freeze(${descriptorJson});
  const patchPaintBoxOriginalRenderControl=renderControl;

  function patchPaintBoxName(control){
    const id=String(control?.id||'').trim();
    return id||'PaintBox';
  }

  function patchPaintBoxNodes(ctx,nodes,locals){
    for(const node of nodes||[]){
      if(node?.kind==='drawPaint'){
        patchPaintBoxDraw(ctx,node.command||{},locals);
        continue;
      }
      if(node?.kind==='if'){
        const branch=Boolean(evaluateExpression(node.expr,locals))?node.thenBody:node.elseBody;
        patchPaintBoxNodes(ctx,branch||[],locals);
        continue;
      }
      if(node?.kind==='repeat'){
        const count=Number(evaluateExpression(node.expr,locals));
        if(!Number.isInteger(count)||count<0||count>100000)throw new PatchAppError('PaintBox repeat needs a whole number from 0 to 100000.');
        for(let index=0;index<count;index+=1)patchPaintBoxNodes(ctx,node.body||[],{...locals,count:index+1});
        continue;
      }
      throw new PatchAppError('PaintBox Web runtime cannot execute '+String(node?.kind||'unknown')+'.');
    }
  }

  function patchPaintBoxDraw(ctx,command,locals){
    const operation=String(command?.operation||'');
    ctx.save();
    try{
      if(operation==='clear'){
        if(command.color==='transparent')ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);
        else{ctx.fillStyle=command.color;ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);}
        return;
      }
      if(operation==='line'){
        if(Number(command.strokeWidth)<=0)return;
        ctx.beginPath();ctx.moveTo(Number(command.x1),Number(command.y1));ctx.lineTo(Number(command.x2),Number(command.y2));
        ctx.strokeStyle=command.stroke;ctx.lineWidth=Number(command.strokeWidth);ctx.stroke();return;
      }
      if(operation==='rectangle'){
        if(command.fill!=='transparent'){ctx.fillStyle=command.fill;ctx.fillRect(Number(command.x),Number(command.y),Number(command.width),Number(command.height));}
        if(Number(command.strokeWidth)>0){ctx.strokeStyle=command.stroke;ctx.lineWidth=Number(command.strokeWidth);ctx.strokeRect(Number(command.x),Number(command.y),Number(command.width),Number(command.height));}
        return;
      }
      if(operation==='ellipse'){
        const x=Number(command.x),y=Number(command.y),width=Number(command.width),height=Number(command.height);
        ctx.beginPath();ctx.ellipse(x+width/2,y+height/2,width/2,height/2,0,0,Math.PI*2);
        if(command.fill!=='transparent'){ctx.fillStyle=command.fill;ctx.fill();}
        if(Number(command.strokeWidth)>0){ctx.strokeStyle=command.stroke;ctx.lineWidth=Number(command.strokeWidth);ctx.stroke();}
        return;
      }
      if(operation==='text'){
        const value=evaluateLoose(command.textExpr,locals);
        ctx.fillStyle=command.color;ctx.font=String(Number(command.fontSize))+'px ui-sans-serif,system-ui,sans-serif';ctx.textBaseline='top';
        ctx.fillText(String(value),Number(command.x),Number(command.y));return;
      }
      if(operation==='image'){
        const src=typeof patchPictureSource==='function'?patchPictureSource(command.source):String(command.source||'');
        const img=patchPaintBoxImage(src);
        if(img&&img.complete&&img.naturalWidth)ctx.drawImage(img,Number(command.x),Number(command.y),Number(command.width),Number(command.height));
        return;
      }
      throw new PatchAppError("PaintBox operation '"+operation+"' is not supported by the Web renderer.");
    }finally{ctx.restore();}
  }

  function patchPaintBoxImage(source){
    const src=String(source||'');
    if(!src)return null;
    window.__PATCH_PAINTBOX_IMAGES=window.__PATCH_PAINTBOX_IMAGES||new Map();
    let img=window.__PATCH_PAINTBOX_IMAGES.get(src);
    if(!img){
      img=new Image();
      img.onload=function(){ if(typeof render==='function') render(); };
      img.src=src;
      window.__PATCH_PAINTBOX_IMAGES.set(src,img);
    }
    return img;
  }

  function patchPaintBoxElement(control){
    const id=String(control?.id||'');
    const descriptor=PATCH_PAINTBOX_DESCRIPTORS[id];
    if(!descriptor)throw new PatchAppError("PaintBox '"+(id||'?')+"' has no generated drawing descriptor.");
    const canvas=document.createElement('canvas');
    canvas.className='patch-paintbox';
    canvas.width=Math.max(16,Number(descriptor.width)||320);
    canvas.height=Math.max(16,Number(descriptor.height)||200);
    canvas.dataset.paintboxId=id;
    canvas.setAttribute('role','img');
    canvas.setAttribute('aria-label',patchPaintBoxName(control)+' drawing surface');
    const ctx=canvas.getContext?.('2d');
    if(ctx){ctx.clearRect(0,0,canvas.width,canvas.height);patchPaintBoxNodes(ctx,descriptor.body||[],{});}
    return canvas;
  }

  renderControl=function(control,windowId,controlIndex){
    if(control?.type==='paintbox')return patchPaintBoxElement(control);
    return patchPaintBoxOriginalRenderControl(control,windowId,controlIndex);
  };

  render();
})();
</script>`;
}

function passwordEditRuntime(ids) {
  const idJson = JSON.stringify(ids).replace(/</g, '\\u003c');
  return `<script data-patch-window-passwordedit>
(function(){
  if(typeof renderControl!=='function'||typeof render!=='function')return;
  const PATCH_PASSWORD_INPUT_IDS=new Set(${idJson});
  const patchPasswordOriginalRenderControl=renderControl;
  renderControl=function(control,windowId,controlIndex){
    const element=patchPasswordOriginalRenderControl(control,windowId,controlIndex);
    if(control?.type==='input'&&PATCH_PASSWORD_INPUT_IDS.has(String(control?.id||''))&&element?.tagName==='INPUT'){
      element.type='password';
      element.dataset.patchInputPresentation='password';
      element.setAttribute('aria-label',String(control?.id||'Password')+' password');
    }
    return element;
  };
  render();
})();
</script>`;
}

function maskedEditRuntime(descriptors) {
  const descriptorJson = JSON.stringify(descriptors).replace(/</g, '\\u003c');
  return `<script data-patch-window-maskededit>
(function(){
  if(typeof renderControl!=='function'||typeof render!=='function')return;
  const PATCH_MASKED_INPUTS=Object.freeze(${descriptorJson});
  const patchMaskedOriginalRenderControl=renderControl;

  function patchMaskSlots(mask){
    const slots=[];const text=String(mask||'');
    for(let index=0;index<text.length;index+=1){
      const char=text[index];
      if(char==='\\\\'){if(index+1<text.length)slots.push({kind:'literal',char:text[++index]});continue;}
      if(char==='0')slots.push({kind:'digit'});
      else if(char==='A')slots.push({kind:'letter'});
      else if(char==='*')slots.push({kind:'alphanumeric'});
      else slots.push({kind:'literal',char});
    }
    return slots;
  }

  function patchMaskMatches(kind,char){
    if(kind==='digit')return /^[0-9]$/.test(char);
    if(kind==='letter')return /^[A-Za-z]$/.test(char);
    return /^[A-Za-z0-9]$/.test(char);
  }

  function patchApplyInputMask(mask,value){
    const slots=patchMaskSlots(mask);
    const literals=new Set(slots.filter(slot=>slot.kind==='literal').map(slot=>slot.char));
    const raw=[...String(value??'')].filter(char=>!literals.has(char));
    const out=[];let sourceIndex=0;let filled=0;
    const tokenCount=slots.filter(slot=>slot.kind!=='literal').length;
    function nextMatching(kind){while(sourceIndex<raw.length){const char=raw[sourceIndex++];if(patchMaskMatches(kind,char))return char;}return null;}
    for(let index=0;index<slots.length;index+=1){
      const slot=slots[index];
      if(slot.kind!=='literal'){const char=nextMatching(slot.kind);if(char===null)break;out.push(char);filled+=1;continue;}
      const hasFutureToken=slots.slice(index+1).some(candidate=>candidate.kind!=='literal');
      const show=filled===0?raw.length>sourceIndex:hasFutureToken?raw.length>sourceIndex:filled===tokenCount;
      if(show)out.push(slot.char);
    }
    return out.join('');
  }

  renderControl=function(control,windowId,controlIndex){
    const element=patchMaskedOriginalRenderControl(control,windowId,controlIndex);
    const descriptor=control?.type==='input'?PATCH_MASKED_INPUTS[String(control?.id||'')]:null;
    if(!descriptor||element?.tagName!=='INPUT')return element;
    element.type='text';
    element.dataset.patchInputPresentation='masked';
    element.dataset.patchInputMask=descriptor.mask;
    element.inputMode=descriptor.inputMode||'text';
    element.maxLength=String(descriptor.placeholder||'').length;
    element.setAttribute('aria-label',String(control?.id||'Input')+' masked input, pattern '+descriptor.placeholder);
    element.value=patchApplyInputMask(descriptor.mask,element.value);
    element.addEventListener('input',function(){
      const next=patchApplyInputMask(descriptor.mask,element.value);
      if(next===element.value)return;
      element.value=next;
      try{element.setSelectionRange(next.length,next.length);}catch{}
    },true);
    return element;
  };
  render();
})();
</script>`;
}
