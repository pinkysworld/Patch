import fs from 'node:fs';

function edit(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`No compatibility change applied to ${path}`);
  fs.writeFileSync(path, after);
}
function once(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first < 0) throw new Error(`Missing compatibility anchor: ${label}`);
  if (source.indexOf(needle, first + needle.length) >= 0) throw new Error(`Ambiguous compatibility anchor: ${label}`);
  return source.slice(0, first) + replacement + source.slice(first + needle.length);
}

edit('src/interpreter.js', s => once(s,
  "  uiTreeNodes(nodes,lists=new Map()){ return (nodes??[]).map(node=>{const list=node.imageListId?lists.get(node.imageListId):null;const resolved=node.imageListId&&node.imageItem?(list?.items??[]).find(image=>image.name===node.imageItem):null;const icon=resolved?.resourceId?`patch-resource:${resolved.resourceId}`:(resolved?.sourceExpr?this.uiText(resolved.sourceExpr):'');return {text:this.uiText(node.labelExpr),imageListId:node.imageListId??null,imageItem:node.imageItem??null,icon,iconWidth:Number(list?.logicalWidth)||16,iconHeight:Number(list?.logicalHeight)||16,children:this.uiTreeNodes(node.children,lists)};}); }",
  "  uiTreeNodes(nodes,lists=new Map()){ return (nodes??[]).map(node=>{const children=this.uiTreeNodes(node.children,lists);const list=node.imageListId?lists.get(node.imageListId):null;const resolved=node.imageListId&&node.imageItem?(list?.items??[]).find(image=>image.name===node.imageItem):null;if(!resolved)return {text:this.uiText(node.labelExpr),children};const icon=resolved.resourceId?`patch-resource:${resolved.resourceId}`:this.uiText(resolved.sourceExpr);return {text:this.uiText(node.labelExpr),imageListId:node.imageListId,imageItem:node.imageItem,icon,iconWidth:Number(list?.logicalWidth)||16,iconHeight:Number(list?.logicalHeight)||16,children};}); }",
  'iconless Tree UI model shape'));

edit('src/webapp.js', s => {
  s = once(s,
    "  const modelNeedles = [\n    \"options:Array.isArray(node.options)?node.options.map(uiOption):[],nodes:node.control==='tree'?uiTreeNodes(node.treeNodes):[],value:\",",
    "  const modelNeedles = [\n    \"options:Array.isArray(node.options)?node.options.map(uiOption):[],nodes:node.control==='tree'?uiTreeNodes(node.treeNodes,lists):[],value:\",\n    \"options:Array.isArray(node.options)?node.options.map(uiOption):[],nodes:node.control==='tree'?uiTreeNodes(node.treeNodes):[],value:\",",
    'table postprocessor Tree model compatibility');
  return once(s,
    "  const modelNeedle = \"nodes:node.control==='tree'?uiTreeNodes(node.treeNodes):[],\";",
    "  const modelNeedle = \"nodes:node.control==='tree'?uiTreeNodes(node.treeNodes,lists):[],\";",
    'Picture postprocessor Tree model compatibility');
});

edit('tests/treeview-standalone-web.test.js', s => {
  s = once(s, "    'function uiTreeNodes(nodes)',", "    'function uiTreeNodes(nodes,lists)',", 'Tree runtime function marker');
  return once(s,
    "    \"type:node.control,id:node.id,text:node.textExpr?uiText(node.textExpr):'',options:Array.isArray(node.options)?node.options.map(uiOption):[],nodes:node.control==='tree'?uiTreeNodes(node.treeNodes):[]\",",
    "    \"type:node.control,id:node.id,text:node.textExpr?uiText(node.textExpr):'',options:Array.isArray(node.options)?node.options.map(uiOption):[],nodes:node.control==='tree'?uiTreeNodes(node.treeNodes,lists):[]\",",
    'Tree runtime model marker');
});

console.log('TreeView node icon compatibility fixes applied.');
