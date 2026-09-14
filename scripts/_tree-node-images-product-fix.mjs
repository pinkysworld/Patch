import fs from 'node:fs';

function replaceOne(path, needle, replacement, label) {
  const source = fs.readFileSync(path, 'utf8');
  const count = source.split(needle).length - 1;
  if (count !== 1) throw new Error(`Expected one ${label} anchor in ${path}, found ${count}`);
  fs.writeFileSync(path, source.replace(needle, replacement));
}

replaceOne(
  'src/interpreter.js',
  [
    '  uiTreeNodes(nodes,lists=new Map()){',
    '    return (nodes??[]).map(node=>{',
    '      const list=node.imageListId?lists.get(node.imageListId):null;',
    '      const image=node.imageListId&&node.imageItem?(list?.items??[]).find(item=>item.name===node.imageItem):null;',
    '      return {',
    '        text:this.uiText(node.labelExpr),',
    '        imageListId:node.imageListId??null,',
    '        imageItem:node.imageItem??null,',
    "        imageSource:image?this.uiText(image.sourceExpr):'',",
    '        imageWidth:Number(list?.logicalWidth)||16,',
    '        imageHeight:Number(list?.logicalHeight)||16,',
    '        children:this.uiTreeNodes(node.children,lists)',
    '      };',
    '    });',
    '  }'
  ].join('\n'),
  [
    '  uiTreeNodes(nodes,lists=new Map()){',
    '    return (nodes??[]).map(node=>{',
    '      const list=node.imageListId?lists.get(node.imageListId):null;',
    '      const image=node.imageListId&&node.imageItem?(list?.items??[]).find(item=>item.name===node.imageItem):null;',
    '      const children=this.uiTreeNodes(node.children,lists);',
    '      const text=this.uiText(node.labelExpr);',
    '      if(!image)return{text,children};',
    '      return {',
    '        text,',
    '        imageListId:node.imageListId,',
    '        imageItem:node.imageItem,',
    '        imageSource:this.uiText(image.sourceExpr),',
    '        imageWidth:Number(list?.logicalWidth)||16,',
    '        imageHeight:Number(list?.logicalHeight)||16,',
    '        children',
    '      };',
    '    });',
    '  }'
  ].join('\n'),
  'interpreter TreeView compatibility'
);

replaceOne(
  'src/window-webapp.js',
  "function uiTreeNodes(nodes,lists=new Map()){return(nodes??[]).map(node=>{const list=node.imageListId?lists.get(node.imageListId):null;const image=node.imageListId&&node.imageItem?(list?.items??[]).find(item=>item.name===node.imageItem):null;return{text:uiText(node.labelExpr),imageListId:node.imageListId||null,imageItem:node.imageItem||null,imageSource:image?uiText(image.sourceExpr):'',imageWidth:Number(list?.logicalWidth)||16,imageHeight:Number(list?.logicalHeight)||16,children:uiTreeNodes(node.children,lists)};});}",
  "function uiTreeNodes(nodes){return uiTreeNodesWithImages(nodes,new Map());}\nfunction uiTreeNodesWithImages(nodes,lists=new Map()){return(nodes??[]).map(node=>{const list=node.imageListId?lists.get(node.imageListId):null;const image=node.imageListId&&node.imageItem?(list?.items??[]).find(item=>item.name===node.imageItem):null;const children=uiTreeNodesWithImages(node.children,lists);const text=uiText(node.labelExpr);if(!image)return{text,children};return{text,imageListId:node.imageListId,imageItem:node.imageItem,imageSource:uiText(image.sourceExpr),imageWidth:Number(list?.logicalWidth)||16,imageHeight:Number(list?.logicalHeight)||16,children};});}",
  'Standalone TreeView compatibility entry point'
);

replaceOne(
  'src/window-webapp.js',
  "nodes:node.control==='tree'?uiTreeNodes(node.treeNodes,lists):[],",
  "nodes:node.control==='tree'?uiTreeNodesWithImages(node.treeNodes,lists):[],",
  'Standalone TreeView image model call'
);

console.log('TreeView node image Stage 1 compatibility fixes applied.');
