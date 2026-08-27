export const PATCH_WINDOW_WEB_PAINTBOX_VERSION = '0.1';

const DEFAULT_WIDTH = 320;
const DEFAULT_HEIGHT = 200;

/**
 * Add the Stage 1 PaintBox Canvas2D renderer to a generated standalone Window app.
 *
 * The renderer is deliberately ephemeral. It rebuilds pixels from visible Patch
 * source every time the ordinary Window runtime renders. Persistent application
 * state remains exclusively in Patch state and can only change through `change`.
 */
export function enhanceStandaloneWindowPaintBoxes(built) {
  if (!built || typeof built.html !== 'string' || built.metadata?.projectKind !== 'window') return built;
  const descriptors = collectPaintBoxDescriptors(built.compiled?.ast ?? []);
  if (!Object.keys(descriptors).length) return built;

  const html = built.html
    .replace('</head>', `${paintBoxStyle()}\n</head>`)
    .replace('</body>', `${paintBoxRuntime(descriptors)}\n</body>`);

  return {
    ...built,
    html,
    metadata: {
      ...built.metadata,
      paintBoxStage: 1,
      paintBoxVersion: PATCH_WINDOW_WEB_PAINTBOX_VERSION,
      paintBoxMode: 'pure-source-backed-canvas2d',
      paintBoxCoordinates: 'source-control-logical-size'
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
      throw new PatchAppError("PaintBox operation '"+operation+"' is not supported by the Web renderer.");
    }finally{ctx.restore();}
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
