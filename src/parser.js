import { parsePatchShapeDeclaration } from './shape-source.js';
import { parsePatchPaintCommand } from './paintbox-control.js';
import {
  PATCH_IMAGELIST_MAX_ITEMS,
  normalizeImageListItemName,
  normalizeImageListLogicalSize,
  normalizeImageListResourceExpression
} from './imagelist-control.js';

export class PatchSyntaxError extends Error {
  constructor(message, line) { super(`line ${line}: ${message}`); this.line = line; }
}

const UNSAFE_THING_FIELDS = new Set(['__proto__', 'prototype', 'constructor']);

function safeThingField(name, line) {
  if (name && UNSAFE_THING_FIELDS.has(name)) {
    throw new PatchSyntaxError(`'${name}' cannot be used as a thing field name. Choose an application field name instead.`, line);
  }
  return name;
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
  function windowNode(row, indent, titleExpr, id, width = null, height = null) {
    if (width !== null && (width < 120 || height < 80)) throw new PatchSyntaxError('A window size must be at least 120 by 80.', row.line);
    const fields = { kind:'window', titleExpr, body:optionalChildBlock(indent), line:row.line };
    if (id) fields.id = id;
    if (width !== null) { fields.width = width; fields.height = height; }
    return fields;
  }
  function tableNode(row, indent, columnsText, id, xText, yText, widthText, heightText) {
    const columns = splitArgs(columnsText);
    if (!columns.length) throw new PatchSyntaxError('A table needs at least one column.', row.line);
    if (i >= lines.length || lines[i].indent <= indent) throw new PatchSyntaxError('A table needs at least one indented row.', row.line);
    const rowIndent = lines[i].indent;
    const rows = [];
    while (i < lines.length && lines[i].indent >= rowIndent) {
      const child = lines[i];
      if (child.indent !== rowIndent) throw new PatchSyntaxError('Table rows must use one consistent indentation level.', child.line);
      const match = child.text.match(/^row\s+(.+)$/);
      if (!match) throw new PatchSyntaxError('A table can only contain rows like row "Ada", "Engineer".', child.line);
      const values = splitArgs(match[1]);
      if (values.length !== columns.length) throw new PatchSyntaxError(`Table row needs exactly ${columns.length} value${columns.length === 1 ? '' : 's'} to match its columns.`, child.line);
      rows.push(values);
      i += 1;
    }
    const fields = { control:'table', textExpr:null, columns, rows, id, line:row.line };
    if (xText !== undefined) return uiControl(fields, parseLayoutNumbers(xText,yText,widthText,heightText,row.line));
    return uiControl(fields, null);
  }
  function treeControlNode(row, indent, id, xText, yText, widthText, heightText) {
    if (i >= lines.length || lines[i].indent <= indent) throw new PatchSyntaxError('A tree needs at least one indented node.', row.line);
    const treeNodes = treeNodesAt(lines[i].indent);
    if (!treeNodes.length) throw new PatchSyntaxError('A tree needs at least one node.', row.line);
    const fields = { control:'tree', textExpr:null, treeNodes, id, line:row.line };
    if (xText !== undefined) return uiControl(fields, parseLayoutNumbers(xText,yText,widthText,heightText,row.line));
    return uiControl(fields, null);
  }
  function imageListNode(row, indent, id, widthText, heightText) {
    let size;
    try {
      size = normalizeImageListLogicalSize(Number(widthText), Number(heightText));
    } catch (error) {
      throw new PatchSyntaxError(error?.message ?? String(error), row.line);
    }
    const items = [];
    const names = new Set();
    if (i < lines.length && lines[i].indent > indent) {
      const itemIndent = lines[i].indent;
      while (i < lines.length && lines[i].indent > indent) {
        const child = lines[i];
        if (child.indent !== itemIndent) {
          throw new PatchSyntaxError('ImageList items must use one consistent indentation level.', child.line);
        }
        const match = child.text.match(/^image\s+([A-Za-z_]\w*)\s+from\s+(.+)$/);
        if (!match) {
          throw new PatchSyntaxError('An ImageList can only contain items like image open from "patch-resource:icons.open".', child.line);
        }
        let name;
        let resource;
        try {
          name = normalizeImageListItemName(match[1]);
          resource = normalizeImageListResourceExpression(match[2]);
        } catch (error) {
          throw new PatchSyntaxError(error?.message ?? String(error), child.line);
        }
        if (names.has(name)) throw new PatchSyntaxError(`ImageList item '${name}' appears more than once.`, child.line);
        names.add(name);
        items.push({ name, sourceExpr: resource.sourceExpr, resourceId: resource.resourceId, line: child.line });
        if (items.length > PATCH_IMAGELIST_MAX_ITEMS) {
          throw new PatchSyntaxError(`ImageList contains more than ${PATCH_IMAGELIST_MAX_ITEMS} images.`, child.line);
        }
        i += 1;
      }
    }
    return uiControl({
      control:'imagelist', textExpr:null, id,
      logicalWidth:size.width, logicalHeight:size.height,
      items, line:row.line
    }, null);
  }
  function panelNode(row, indent, id, layout) {
    const body = optionalChildBlock(indent);
    for (const child of body) {
      if (child.kind !== 'uiControl') throw new PatchSyntaxError('A panel can only contain window controls in Panel Stage 1.', child.line);
      if (['panel', 'timer', 'imagelist', 'statusbar', 'table', 'tree', 'paintbox'].includes(child.control)) {
        throw new PatchSyntaxError('Panel Stage 1 cannot nest Panel, Timer, ImageList, StatusBar, Table, TreeView or PaintBox.', child.line);
      }
      if (child.layout) throw new PatchSyntaxError('Controls inside a panel use flow layout in Panel Stage 1. Remove at/size from the nested control.', child.line);
    }
    return uiControl({ control: 'panel', textExpr: null, id, body, line: row.line }, layout);
  }
  function treeNodesAt(nodeIndent) {
    const nodes = [];
    while (i < lines.length) {
      const child = lines[i];
      if (child.indent < nodeIndent) break;
      if (child.indent > nodeIndent) throw new PatchSyntaxError('Tree nodes must use consistent indentation under their parent.', child.line);
      const match = child.text.match(/^node\s+(.+)$/);
      if (!match) throw new PatchSyntaxError('A tree can only contain nodes like node "src".', child.line);
      i += 1;
      const children = i < lines.length && lines[i].indent > nodeIndent ? treeNodesAt(lines[i].indent) : [];
      nodes.push({ labelExpr:match[1], children, line:child.line });
    }
    return nodes;
  }
  function statement(indent) {
    const row = lines[i++];
    let m;
    if ((m = row.text.match(/^create\s+(number|text|boolean|list)\s+([A-Za-z_]\w*)\s*=\s*(.+)$/))) return { kind:'create', valueType:m[1], name:m[2], expr:m[3], line:row.line };
    if ((m = row.text.match(/^create\s+(?:thing\s+)?([A-Za-z_]\w*)\s*:\s*$/))) {
      const fields = childBlock(indent,row).map(n=>{ if(n.kind!=='field') throw new PatchSyntaxError('A thing can only contain fields like name = "Sam".',n.line); return n; });
      return {kind:'createThing',name:m[1],fields,line:row.line};
    }
    if ((m = row.text.match(/^window\s+(.+?)\s+as\s+([A-Za-z_]\w*)\s+size\s+(\d+)\s*,\s*(\d+)\s*:\s*$/))) return windowNode(row,indent,m[1],m[2],Number(m[3]),Number(m[4]));
    if ((m = row.text.match(/^window\s+(.+?)\s+as\s+([A-Za-z_]\w*)\s*:\s*$/))) return windowNode(row,indent,m[1],m[2]);
    if ((m = row.text.match(/^window\s+(.+?)\s+size\s+(\d+)\s*,\s*(\d+)\s*:\s*$/))) return windowNode(row,indent,m[1],null,Number(m[2]),Number(m[3]));
    if ((m = row.text.match(/^window\s+(.+)\s*:\s*$/))) return windowNode(row,indent,m[1],null);

    if ((m = row.text.match(/^menu\s+(.+)\s*:\s*$/))) {
      const items = childBlock(indent,row);
      if (!items.length) throw new PatchSyntaxError('A menu needs at least one item.',row.line);
      for (const item of items) {
        if (item.kind !== 'menuItem' && item.kind !== 'menuSeparator') {
          throw new PatchSyntaxError('A menu can only contain items and separator lines.',item.line);
        }
      }
      if (!items.some(item => item.kind === 'menuItem')) throw new PatchSyntaxError('A menu needs at least one clickable item.',row.line);
      if (items[0].kind === 'menuSeparator' || items.at(-1).kind === 'menuSeparator') {
        throw new PatchSyntaxError('A menu separator must appear between clickable items.',row.line);
      }
      for (let index = 1; index < items.length; index += 1) {
        if (items[index - 1].kind === 'menuSeparator' && items[index].kind === 'menuSeparator') {
          throw new PatchSyntaxError('Menu separators cannot appear next to each other.',items[index].line);
        }
      }
      return {kind:'menu',titleExpr:m[1],body:items,line:row.line};
    }
    if (row.text === 'separator') return {kind:'menuSeparator',line:row.line};
    if ((m = row.text.match(/^item\s+(.+?)\s+as\s+([A-Za-z_]\w*)(?:\s+enabled\s+([A-Za-z_]\w*))?(?:\s+checked\s+([A-Za-z_]\w*))?(?:\s+shortcut\s+(.+))?\s*$/))) {
      return {
        kind:'menuItem',
        textExpr:m[1],
        id:m[2],
        enabledState:m[3]??null,
        checkedState:m[4]??null,
        shortcutExpr:m[5]??null,
        line:row.line
      };
    }

    if ((m = row.text.match(/^imagelist\s+as\s+([A-Za-z_]\w*)\s+size\s+(\d+)\s*,\s*(\d+)\s*:\s*$/))) {
      return imageListNode(row, indent, m[1], m[2], m[3]);
    }
    if ((m = row.text.match(/^tabs\s+as\s+([A-Za-z_]\w*)(?:\s+at\s+(-?\d+)\s*,\s*(-?\d+)(?:\s+size\s+(\d+)\s*,\s*(\d+))?)?\s*:\s*$/))) {
      const pages = childBlock(indent,row);
      if (pages.length < 2) throw new PatchSyntaxError('Tabs needs at least two tab pages.',row.line);
      for (const page of pages) if (page.kind !== 'tabPage') throw new PatchSyntaxError('A tabs block can only contain pages like tab "General":.',page.line);
      const fields = {kind:'tabs',id:m[1],body:pages,line:row.line};
      if (m[2] !== undefined) fields.layout = parseLayoutNumbers(m[2],m[3],m[4],m[5],row.line);
      return fields;
    }
    if ((m = row.text.match(/^tab\s+(.+)\s*:\s*$/))) {
      const body = childBlock(indent,row);
      for (const child of body) {
        if (child.kind !== 'uiControl') throw new PatchSyntaxError('A tab page can only contain window controls in Tabs Stage 1.',child.line);
        if (['panel', 'timer', 'imagelist', 'statusbar'].includes(child.control)) {
          throw new PatchSyntaxError('Tabs Stage 1 pages cannot contain Panel, Timer, ImageList or StatusBar.',child.line);
        }
        if (child.layout) throw new PatchSyntaxError('Controls inside a tab page use flow layout in Tabs Stage 1. Remove at/size from the nested control.',child.line);
      }
      return {kind:'tabPage',titleExpr:m[1],body,line:row.line};
    }
    if ((m = row.text.match(/^panel\s+as\s+([A-Za-z_]\w*)(?:\s+at\s+(-?\d+)\s*,\s*(-?\d+)(?:\s+size\s+(\d+)\s*,\s*(\d+))?)?\s*:\s*$/))) {
      return panelNode(row, indent, m[1], m[2] !== undefined ? parseLayoutNumbers(m[2], m[3], m[4], m[5], row.line) : null);
    }
    if ((m = row.text.match(/^tree\s+as\s+([A-Za-z_]\w*)(?:\s+at\s+(-?\d+)\s*,\s*(-?\d+)(?:\s+size\s+(\d+)\s*,\s*(\d+))?)?\s*:\s*$/))) {
      return treeControlNode(row, indent, m[1], m[2], m[3], m[4], m[5]);
    }
    if ((m = row.text.match(/^table\s+(.+?)\s+as\s+([A-Za-z_]\w*)(?:\s+at\s+(-?\d+)\s*,\s*(-?\d+)(?:\s+size\s+(\d+)\s*,\s*(\d+))?)?\s*:\s*$/))) {
      return tableNode(row, indent, m[1], m[2], m[3], m[4], m[5], m[6]);
    }

    const ui=parseUILayout(row.text,row.line);
    if ((m = ui.core.match(/^text\s+(.+)$/))) return uiControl({control:'text',textExpr:m[1],id:null,line:row.line},ui.layout);
    if ((m = ui.core.match(/^button\s+(.+?)\s+as\s+([A-Za-z_]\w*)$/))) return uiControl({control:'button',textExpr:m[1],id:m[2],line:row.line},ui.layout);
    if ((m = ui.core.match(/^checkbox\s+(.+?)\s+as\s+([A-Za-z_]\w*)$/))) return uiControl({control:'checkbox',textExpr:m[1],id:m[2],line:row.line},ui.layout);
    if ((m = ui.core.match(/^radio\s+(.+?)\s+as\s+([A-Za-z_]\w*)$/))) {
      const options=splitArgs(m[1]);
      if(options.length<2)throw new PatchSyntaxError('A radio group needs at least two options.',row.line);
      return uiControl({control:'radio',textExpr:null,options,id:m[2],line:row.line},ui.layout);
    }
    if ((m = ui.core.match(/^combo\s+(.+?)\s+as\s+([A-Za-z_]\w*)$/))) {
      const options=splitArgs(m[1]);
      if(options.length<2)throw new PatchSyntaxError('A combo needs at least two options.',row.line);
      return uiControl({control:'combo',textExpr:null,options,id:m[2],line:row.line},ui.layout);
    }
    if ((m = ui.core.match(/^listbox\s+(.+?)\s+as\s+([A-Za-z_]\w*)$/))) {
      const options=splitArgs(m[1]);
      if(options.length<2)throw new PatchSyntaxError('A listbox needs at least two options.',row.line);
      return uiControl({control:'listbox',textExpr:null,options,id:m[2],line:row.line},ui.layout);
    }
    if ((m = ui.core.match(/^slider\s+([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*\.\.\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s+as\s+([A-Za-z_]\w*)(?:\s+step\s+([+-]?(?:\d+(?:\.\d*)?|\.\d+)))?$/))) {
      const min=Number(m[1]); const max=Number(m[2]); const step=m[4]===undefined?1:Number(m[4]);
      if(!(min<max))throw new PatchSyntaxError('A slider range must go from a smaller number to a larger number.',row.line);
      if(!(step>0))throw new PatchSyntaxError('A slider step must be greater than zero.',row.line);
      return uiControl({control:'slider',textExpr:null,id:m[3],min,max,step,line:row.line},ui.layout);
    }
    if ((m = ui.core.match(/^timer\s+as\s+([A-Za-z_]\w*)\s+interval\s+(\d+)$/))) {
      const interval = Number(m[2]);
      if (!Number.isInteger(interval) || interval < 1 || interval > 3600000) {
        throw new PatchSyntaxError('A timer interval must be a whole number of milliseconds from 1 to 3600000.', row.line);
      }
      return uiControl({control:'timer',textExpr:null,id:m[1],interval,line:row.line},ui.layout);
    }
    if ((m = ui.core.match(/^picture\s+as\s+([A-Za-z_]\w*)\s+from\s+(.+)$/))) {
      return uiControl({control:'picture',textExpr:null,sourceExpr:m[2],id:m[1],line:row.line},ui.layout);
    }
    if ((m = ui.core.match(/^picture\s+as\s+([A-Za-z_]\w*)$/))) {
      return uiControl({control:'picture',textExpr:null,sourceExpr:null,id:m[1],line:row.line},ui.layout);
    }
    if ((m = ui.core.match(/^picture\s+(.+?)\s+as\s+([A-Za-z_]\w*)$/))) {
      return uiControl({control:'picture',textExpr:m[1],sourceExpr:null,id:m[2],line:row.line},ui.layout);
    }
    if (/^shape\b/i.test(ui.core)) {
      try {
        const shape = parsePatchShapeDeclaration(ui.core);
        return uiControl({
          control:'shape', textExpr:null, id:shape.id,
          shapeKind:shape.kind, fill:shape.fill, stroke:shape.stroke,
          strokeWidth:shape.strokeWidth, cornerRadius:shape.cornerRadius,
          opacity:shape.opacity, line:row.line
        }, ui.layout);
      } catch (error) {
        throw new PatchSyntaxError(error?.message ?? String(error), row.line);
      }
    }
    if ((m = ui.core.match(/^paintbox\s+as\s+([A-Za-z_]\w*)$/))) {
      return uiControl({control:'paintbox',textExpr:null,id:m[1],line:row.line},ui.layout);
    }
    if ((m = ui.core.match(/^statusbar\s+(.+?)\s+as\s+([A-Za-z_]\w*)$/))) {
      return uiControl({control:'statusbar',textExpr:m[1],id:m[2],line:row.line},ui.layout);
    }
    if ((m = ui.core.match(/^statusbar\s+as\s+([A-Za-z_]\w*)$/))) {
      return uiControl({control:'statusbar',textExpr:'"Ready"',id:m[1],line:row.line},ui.layout);
    }
    if ((m = ui.core.match(/^input\s+([A-Za-z_]\w*)$/))) return uiControl({control:'input',textExpr:null,id:m[1],line:row.line},ui.layout);
    if ((m = row.text.match(/^when\s+([A-Za-z_]\w*)\s+(clicked|changed|closed|confirmed|chosen|cancelled|ticked|paint)\s*:\s*$/))) return {kind:'event',control:m[1],event:m[2],body:childBlock(indent,row),line:row.line};
    if ((m = row.text.match(/^confirm\s+(.+?)\s+as\s+([A-Za-z_]\w*)\s*$/))) {
      const parts=splitArgs(m[1]);
      if(parts.length!==2)throw new PatchSyntaxError('A confirm dialog needs exactly a title and message, for example confirm "Delete?", "This cannot be undone." as confirm_delete.',row.line);
      return {kind:'confirmDialog',titleExpr:parts[0],messageExpr:parts[1],id:m[2],line:row.line};
    }
    if ((m = row.text.match(/^open\s+file\s+(.+?)\s+as\s+([A-Za-z_]\w*)\s*$/))) return {kind:'openFileDialog',titleExpr:m[1],id:m[2],line:row.line};
    if ((m = row.text.match(/^save\s+file\s+(.+?)\s+as\s+([A-Za-z_]\w*)\s*$/))) return {kind:'saveFileDialog',titleExpr:m[1],id:m[2],line:row.line};
    if ((m = row.text.match(/^open\s+([A-Za-z_]\w*)$/))) return {kind:'openForm',form:m[1],line:row.line};
    if ((m = row.text.match(/^close\s+([A-Za-z_]\w*)$/))) return {kind:'closeForm',form:m[1],line:row.line};
    if ((m = row.text.match(/^dialog\s+(.+)$/))) {
      const parts=splitArgs(m[1]);
      if(parts.length!==2)throw new PatchSyntaxError('A dialog needs exactly a title and message, for example dialog "About", "Hello".',row.line);
      return {kind:'dialog',titleExpr:parts[0],messageExpr:parts[1],line:row.line};
    }
    if ((m = row.text.match(/^allow\s+([A-Za-z_]\w*)\s*:\s*$/))) {
      const rules=childBlock(indent,row); for(const rule of rules) if(rule.kind!=='capRule') throw new PatchSyntaxError('An allow block can only contain rules like player.score may increase up to 10.',rule.line);
      return {kind:'allow',name:m[1],rules,line:row.line};
    }
    if ((m = row.text.match(/^([A-Za-z_]\w*)(?:\.([A-Za-z_]\w*))?\s+may\s+(increase|decrease|add|remove|set|clear)(?:\s+up\s+to\s+([0-9]+(?:\.[0-9]+)?))?$/))) {
      safeThingField(m[2], row.line);
      const maxAmount=m[4]===undefined?null:Number(m[4]);
      if(maxAmount!==null&&!['increase','decrease','add','remove'].includes(m[3])) throw new PatchSyntaxError(`'up to' is only meaningful for increase, decrease, add, or remove.`,row.line);
      return {kind:'capRule',target:m[1],field:m[2]??null,operation:m[3],maxAmount,line:row.line};
    }
    if (/^draw\b/i.test(row.text)) {
      try {
        return {kind:'drawPaint',command:parsePatchPaintCommand(row.text),line:row.line};
      } catch (error) {
        throw new PatchSyntaxError(error?.message ?? String(error), row.line);
      }
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
    if ((m = row.text.match(/^set(?:\s+([A-Za-z_]\w*))?\s*=\s*(.+)$/))) { safeThingField(m[1], row.line); return {kind:'changeOp',op:'set',field:m[1]??null,expr:m[2],line:row.line}; }
    if ((m = row.text.match(/^add\s+(.+?)(?:\s+to\s+([A-Za-z_]\w*))?$/))) { safeThingField(m[2], row.line); return {kind:'changeOp',op:'add',field:m[2]??null,expr:m[1],line:row.line}; }
    if ((m = row.text.match(/^remove\s+(.+?)(?:\s+from\s+([A-Za-z_]\w*))?$/))) { safeThingField(m[2], row.line); return {kind:'changeOp',op:'remove',field:m[2]??null,expr:m[1],line:row.line}; }
    if ((m = row.text.match(/^clear(?:\s+([A-Za-z_]\w*))?$/))) { safeThingField(m[1], row.line); return {kind:'changeOp',op:'clear',field:m[1]??null,line:row.line}; }
    if ((m = row.text.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/))) { safeThingField(m[1], row.line); return {kind:'field',name:m[1],expr:m[2],line:row.line}; }
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
  const program = block(0);
  validatePaintBoxProgram(program);
  return program;
}

function validatePaintBoxProgram(nodes) {
  for (const node of nodes ?? []) {
    if (node.kind === 'event' && node.event === 'paint') {
      validatePaintBody(node.body);
      continue;
    }
    if (node.kind === 'drawPaint') {
      throw new PatchSyntaxError('A draw command belongs only inside a PaintBox paint handler such as when canvas paint:.', node.line);
    }
    if (node.body) validatePaintBoxProgram(node.body);
    if (node.thenBody) validatePaintBoxProgram(node.thenBody);
    if (node.elseBody) validatePaintBoxProgram(node.elseBody);
  }
}

function validatePaintBody(nodes) {
  for (const node of nodes ?? []) {
    if (node.kind === 'drawPaint') continue;
    if (node.kind === 'if') {
      validatePaintBody(node.thenBody);
      validatePaintBody(node.elseBody);
      continue;
    }
    if (node.kind === 'repeat') {
      validatePaintBody(node.body);
      continue;
    }
    throw new PatchSyntaxError(
      'PaintBox Stage 1 paint handlers may contain only draw, if and repeat. Persistent application changes belong outside paint handlers.',
      node.line
    );
  }
}

function uiControl(fields,layout) { return layout ? {kind:'uiControl',...fields,layout} : {kind:'uiControl',...fields}; }
function parseUILayout(text,line) {
  const m=String(text).match(/^(.*?)(?:\s+at\s+(-?\d+)\s*,\s*(-?\d+)(?:\s+size\s+(\d+)\s*,\s*(\d+))?)?$/);
  if(!m||m[2]===undefined)return {core:String(text),layout:null};
  return {core:m[1],layout:parseLayoutNumbers(m[2],m[3],m[4],m[5],line)};
}
function parseLayoutNumbers(xText,yText,widthText,heightText,line) {
  const x=Number(xText); const y=Number(yText);
  const width=widthText===undefined?null:Number(widthText); const height=heightText===undefined?null:Number(heightText);
  if(x<0||y<0)throw new PatchSyntaxError('Control positions must be zero or greater.',line);
  if((width!==null&&width<16)||(height!==null&&height<16))throw new PatchSyntaxError('Control sizes must be at least 16 by 16.',line);
  return {x,y,width,height};
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