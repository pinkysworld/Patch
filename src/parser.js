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
  function statement(indent) {
    const row = lines[i++];
    let m;
    if ((m = row.text.match(/^create\s+(number|text|boolean|list)\s+([A-Za-z_]\w*)\s*=\s*(.+)$/))) return { kind:'create', valueType:m[1], name:m[2], expr:m[3], line:row.line };
    if ((m = row.text.match(/^create\s+(?:thing\s+)?([A-Za-z_]\w*)\s*:\s*$/))) {
      const fields = childBlock(indent,row).map(n=>{ if(n.kind!=='field') throw new PatchSyntaxError('A thing can only contain fields like name = "Sam".',n.line); return n; });
      return {kind:'createThing',name:m[1],fields,line:row.line};
    }
    if ((m = row.text.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/))) return {kind:'field',name:m[1],expr:m[2],line:row.line};
    if ((m = row.text.match(/^show\s+(.+)$/))) return {kind:'show',expr:m[1],line:row.line};
    if ((m = row.text.match(/^watch\s+([A-Za-z_]\w*)$/))) return {kind:'watch',target:m[1],line:row.line};
    if ((m = row.text.match(/^history\s+([A-Za-z_]\w*)$/))) return {kind:'history',target:m[1],line:row.line};
    if ((m = row.text.match(/^undo(?:\s+([A-Za-z_]\w*))?$/))) return {kind:'undo',name:m[1]??null,line:row.line};
    if (row.text === 'redo') return {kind:'redo',line:row.line};
    if (row.text === 'preview:') return {kind:'preview',body:childBlock(indent,row),line:row.line};
    if ((m = row.text.match(/^change\s+([A-Za-z_]\w*)(?:\s+called\s+([A-Za-z_]\w*))?\s*:\s*$/))) {
      const ops=childBlock(indent,row); for(const op of ops) if(op.kind!=='changeOp') throw new PatchSyntaxError('Only set, add, remove, or clear can appear directly inside change.',op.line);
      return {kind:'change',target:m[1],name:m[2]??null,ops,line:row.line};
    }
    if ((m = row.text.match(/^set(?:\s+([A-Za-z_]\w*))?\s*=\s*(.+)$/))) return {kind:'changeOp',op:'set',field:m[1]??null,expr:m[2],line:row.line};
    if ((m = row.text.match(/^add\s+(.+?)(?:\s+to\s+([A-Za-z_]\w*))?$/))) return {kind:'changeOp',op:'add',field:m[2]??null,expr:m[1],line:row.line};
    if ((m = row.text.match(/^remove\s+(.+?)(?:\s+from\s+([A-Za-z_]\w*))?$/))) return {kind:'changeOp',op:'remove',field:m[2]??null,expr:m[1],line:row.line};
    if ((m = row.text.match(/^clear(?:\s+([A-Za-z_]\w*))?$/))) return {kind:'changeOp',op:'clear',field:m[1]??null,line:row.line};
    if ((m = row.text.match(/^if\s+(.+)\s*:\s*$/))) {
      const thenBody=childBlock(indent,row); let elseBody=[];
      if(i<lines.length&&lines[i].indent===indent&&lines[i].text==='else:'){const elseRow=lines[i++];elseBody=childBlock(indent,elseRow);}
      return {kind:'if',expr:m[1],thenBody,elseBody,line:row.line};
    }
    if ((m = row.text.match(/^repeat\s+(.+)\s*:\s*$/))) return {kind:'repeat',expr:m[1],body:childBlock(indent,row),line:row.line};
    if ((m = row.text.match(/^make\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*:\s*$/))) {
      const params=m[2].trim()?m[2].split(',').map(x=>x.trim()):[]; return {kind:'function',name:m[1],params,body:childBlock(indent,row),line:row.line};
    }
    if ((m = row.text.match(/^do\s+([A-Za-z_]\w*)\s*\((.*)\)\s*$/))) return {kind:'call',name:m[1],args:splitArgs(m[2]),line:row.line};
    if ((m = row.text.match(/^return(?:\s+(.+))?$/))) return {kind:'return',expr:m[1]??null,line:row.line};
    throw new PatchSyntaxError(`I do not understand '${row.text}'.`,row.line);
  }
  return block(0);
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
