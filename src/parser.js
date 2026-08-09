export class PatchSyntaxError extends Error {
  constructor(message, line) { super(`line ${line}: ${message}`); this.line = line; }
}

function sourceLines(source) {
  const rows = [];
  source.replace(/\t/g, '  ').split(/\r?\n/).forEach((raw, index) => {
    if (!raw.trim() || raw.trimStart().startsWith('#')) return;
    const indent = raw.length - raw.trimStart().length;
    rows.push({ text: raw.trim(), indent, line: index + 1 });
  });
  return rows;
}

export function parse(source) {
  const lines = sourceLines(source);
  let i = 0;
  function block(indent) {
    const nodes = [];
    while (i < lines.length) {
      const row = lines[i];
      if (row.indent < indent) break;
      if (row.indent > indent) throw new PatchSyntaxError('This line is indented too far.', row.line);
      if (row.text === 'else:') break;
      nodes.push(statement(indent));
    }
    return nodes;
  }
  function childBlock(parentIndent, row) {
    if (i >= lines.length || lines[i].indent <= parentIndent) throw new PatchSyntaxError('Expected an indented block below this line.', row.line);
    return block(lines[i].indent);
  }
  function optionalChildBlock(parentIndent) {
    if (i >= lines.length || lines[i].indent <= parentIndent) return [];
    return block(lines[i].indent);
  }
  function statement(indent) {
    const row = lines[i++];
    let m;
    if ((m = row.text.match(/^create\s+(number|text|boolean|list)\s+([A-Za-z_]\w*)\s*=\s*(.+)$/))) return { kind:'create', valueType:m[1], name:m[2], expr:m[3], line:row.line };
    if ((m = row.text.match(/^create\s+(?:thing\s+)?([A-Za-z_]\w*)\s*:\s*$/))) {
      const fields = childBlock(indent,row).map(n=>{ if(n.kind!=='field') throw new PatchSyntaxError('A thing can only contain fields like name = "Sam".',n.line); return n; });
      return {kind:'createThing',name:m[1],fields,line:row.line};
    }
    if ((m = row.text.match(/^window\s+(.+?)\s+size\s+(\d+)\s*,\s*(\d+)\s*:\s*$/))) {
      const width=Number(m[2]); const height=Number(m[3]);
      if(width<120||height<80) throw new PatchSyntaxError('A window size must be at least 120 by 80.',row.line);
      return {kind:'window',titleExpr:m[1],width,height,body:optionalChildBlock(indent),line:row.line};
    }
    if ((m = row.text.match(/^window\s+(.+)\s*:\s*$/))) return {kind:'window',titleExpr:m[1],body:optionalChildBlock(indent),line:row.line};

    const ui=parseUILayout(row.text,row.line);
    if ((m = ui.core.match(/^text\s+(.+)$/))) return uiControl({control:'text',textExpr:m[1],id:null,line:row.line},ui.layout);
    if ((m = ui.core.match(/^button\s+(.+?)\s+as\s+([A-Za-z_]\w*)$/))) return uiControl({control:'button',textExpr:m[1],id:m[2],line:row.line},ui.layout);
    if ((m = ui.core.match(/^input\s+([A-Za-z_]\w*)$/))) return uiControl({control:'input',textExpr:null,id:m[1],line:row.line},ui.layout);
    if ((m = row.text.match(/^when\s+([A-Za-z_]\w*)\s+(clicked|changed|closed)\s*:\s*$/))) return {kind:'event',control:m[1],event:m[2],body:childBlock(indent,row),line:row.line};
    if ((m = row.text.match(/^allow\s+([A-Za-z_]\w*)\s*:\s*$/))) {
      const rules=childBlock(indent,row); for(const rule of rules) if(rule.kind!=='capRule') throw new PatchSyntaxError('An allow block can only contain rules like player.score may increase up to 10.',rule.line);
      return {kind:'allow',name:m[1],rules,line:row.line};
    }
    if ((m = row.text.match(/^([A-Za-z_]\w*)(?:\.([A-Za-z_]\w*))?\s+may\s+(increase|decrease|add|remove|set|clear)(?:\s+up\s+to\s+([0-9]+(?:\.[0-9]+)?))?$/))) {
      const maxAmount=m[4]===undefined?null:Number(m[4]);
      if(maxAmount!==null&&!['increase','decrease','add','remove'].includes(m[3])) throw new PatchSyntaxError(`'up to' is only meaningful for increase, decrease, add, or remove.`,row.line);
      return {kind:'capRule',target:m[1],field:m[2]??null,operation:m[3],maxAmount,line:row.line};
    }
    if ((m = row.text.match(/^show\s+(.+)$/))) return {kind:'show',expr:m[1],line:row.line};
    if ((m = row.text.match(/^why\s+(.+)$/))) return {kind:'why',expr:m[1],line:row.line};
    if ((m = row.text.match(/^watch\s+([A-Za-z_]\w*)$/))) return {kind:'watch',target:m[1],line:row.line};
    if ((m = row.text.match(/^history\s+([A-Za-z_]\w*)$/))) return {kind:'history',target:m[1],line:row.line};
    if ((m = row.text.match(/^undo(?:\s+([A-Za-z_]\w*))?$/))) return {kind:'undo',name:m[1]??null,line:row.line};
    if (row.text === 'redo') return {kind:'redo',line:row.line};
    if (row.text === 'preview:') return {kind:'preview',body:childBlock(indent,row),line:row.line};
    if ((m = row.text.match(/^change\s+([A-Za-z_]\w*)(?:\s+called\s+([A-Za-z_]\w*))?\s*:\s*$/))) {
      const ops=childBlock(indent,row); for(const op of ops) if(op.kind!=='changeOp') throw new PatchSyntaxError('Only set, add, remove, or clear can appear directly inside change.',op.line);
      return {kind:'change',target:m[1],name:m[2]??null,ops,line:row.line};
    }
    // Change verbs are parsed before generic `name = value` thing fields. This
    // keeps scalar `set = value` unambiguous while preserving normal field
    // initializers such as `name = "Sam"` inside create thing blocks.
    if ((m = row.text.match(/^set(?:\s+([A-Za-z_]\w*))?\s*=\s*(.+)$/))) return {kind:'changeOp',op:'set',field:m[1]??null,expr:m[2],line:row.line};
    if ((m = row.text.match(/^add\s+(.+?)(?:\s+to\s+([A-Za-z_]\w*))?$/))) return {kind:'changeOp',op:'add',field:m[2]??null,expr:m[1],line:row.line};
    if ((m = row.text.match(/^remove\s+(.+?)(?:\s+from\s+([A-Za-z_]\w*))?$/))) return {kind:'changeOp',op:'remove',field:m[2]??null,expr:m[1],line:row.line};
    if ((m = row.text.match(/^clear(?:\s+([A-Za-z_]\w*))?$/))) return {kind:'changeOp',op:'clear',field:m[1]??null,line:row.line};
    if ((m = row.text.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/))) return {kind:'field',name:m[1],expr:m[2],line:row.line};
    if ((m = row.text.match(/^if\s+(.+)\s*:\s*$/))) {
      const thenBody=childBlock(indent,row); let elseBody=[];
      if(i<lines.length&&lines[i].indent===indent&&lines[i].text==='else:'){const elseRow=lines[i++];elseBody=childBlock(indent,elseRow);}
      return {kind:'if',expr:m[1],thenBody,elseBody,line:row.line};
    }
    if ((m = row.text.match(/^repeat\s+(.+)\s*:\s*$/))) return {kind:'repeat',expr:m[1],body:childBlock(indent,row),line:row.line};
    if ((m = row.text.match(/^make\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*:\s*$/))) {
      const parsed=parseParams(m[2],row.line);
      return {kind:'function',name:m[1],params:parsed.names,paramRanges:parsed.ranges,body:childBlock(indent,row),line:row.line};
    }
    if ((m = row.text.match(/^do\s+([A-Za-z_]\w*)\s*\((.*)\)\s*$/))) return {kind:'call',name:m[1],args:splitArgs(m[2]),line:row.line};
    if ((m = row.text.match(/^return(?:\s+(.+))?$/))) return {kind:'return',expr:m[1]??null,line:row.line};
    throw new PatchSyntaxError(`I do not understand '${row.text}'.`,row.line);
  }
  return block(0);
}

function uiControl(fields,layout) {
  return layout ? {kind:'uiControl',...fields,layout} : {kind:'uiControl',...fields};
}

function parseUILayout(text,line) {
  const m=String(text).match(/^(.*?)(?:\s+at\s+(-?\d+)\s*,\s*(-?\d+)(?:\s+size\s+(\d+)\s*,\s*(\d+))?)?$/);
  if(!m||m[2]===undefined)return {core:String(text),layout:null};
  const x=Number(m[2]); const y=Number(m[3]);
  const width=m[4]===undefined?null:Number(m[4]); const height=m[5]===undefined?null:Number(m[5]);
  if(x<0||y<0)throw new PatchSyntaxError('Control positions must be zero or greater.',line);
  if((width!==null&&width<16)||(height!==null&&height<16))throw new PatchSyntaxError('Control sizes must be at least 16 by 16.',line);
  return {core:m[1],layout:{x,y,width,height}};
}

function parseParams(text,line) {
  if(!text.trim())return {names:[],ranges:{}};
  const names=[]; const ranges={};
  const number='[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
  const re=new RegExp(`^([A-Za-z_]\\w*)(?:\\s+number\\s+(${number})\\.\\.(${number}))?$`);
  for(const part of splitArgs(text)){
    const m=part.match(re);
    if(!m)throw new PatchSyntaxError(`I do not understand recipe parameter '${part}'. Use name or name number 0..10.`,line);
    if(names.includes(m[1]))throw new PatchSyntaxError(`Recipe parameter '${m[1]}' is declared more than once.`,line);
    names.push(m[1]);
    if(m[2]!==undefined){
      const min=Number(m[2]); const max=Number(m[3]);
      if(min>max)throw new PatchSyntaxError(`Range for '${m[1]}' must go from a smaller number to a larger number.`,line);
      ranges[m[1]]={min,max};
    }
  }
  return {names,ranges};
}

function splitArgs(text) {
  if(!text.trim()) return [];
  const out=[]; let current=''; let quote=null; let depth=0;
  for(const ch of text){
    if(quote){current+=ch;if(ch===quote)quote=null;continue;}
    if(ch==='"'||ch==="'"){quote=ch;current+=ch;continue;}
    if(ch==='('||ch==='[')depth++; if(ch===')'||ch===']')depth--;
    if(ch===','&&depth===0){out.push(current.trim());current='';continue;} current+=ch;
  }
  if(current.trim())out.push(current.trim()); return out;
}
