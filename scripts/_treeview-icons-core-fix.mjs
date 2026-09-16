import fs from 'node:fs';

function replaceOne(path, from, to, label) {
  const source = fs.readFileSync(path, 'utf8');
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`Expected one anchor for ${label}, found ${count}.`);
  fs.writeFileSync(path, source.replace(from, to));
}

replaceOne(
  'src/interpreter.js',
  "  uiTreeNodes(nodes,lists=new Map()){ return (nodes??[]).map(node=>{const list=node.imageListId?lists.get(node.imageListId):null;const image=node.imageItem?(list?.items??[]).find(item=>item.name===node.imageItem):null;return {text:this.uiText(node.labelExpr),imageSource:image?this.uiText(image.sourceExpr):'',imageWidth:Number(list?.logicalWidth)||16,imageHeight:Number(list?.logicalHeight)||16,children:this.uiTreeNodes(node.children,lists)};}); }",
  "  uiTreeNodes(nodes,lists=new Map()){ return (nodes??[]).map(node=>{const list=node.imageListId?lists.get(node.imageListId):null;const image=node.imageItem?(list?.items??[]).find(item=>item.name===node.imageItem):null;const imageMeta=image?{imageSource:this.uiText(image.sourceExpr),imageWidth:Number(list?.logicalWidth)||16,imageHeight:Number(list?.logicalHeight)||16}:{};return {text:this.uiText(node.labelExpr),...imageMeta,children:this.uiTreeNodes(node.children,lists)};}); }",
  'plain TreeView UI model compatibility'
);

replaceOne(
  'src/window-webapp.js',
  "function uiTreeNodes(nodes,lists=new Map()){return(nodes??[]).map(node=>{const list=node.imageListId?lists.get(node.imageListId):null;const image=node.imageItem?(list?.items??[]).find(item=>item.name===node.imageItem):null;return{text:uiText(node.labelExpr),imageSource:image?uiText(image.sourceExpr):'',imageWidth:Number(list?.logicalWidth)||16,imageHeight:Number(list?.logicalHeight)||16,children:uiTreeNodes(node.children,lists)};});}",
  "let currentTreeImageLists=new Map();function uiTreeNodes(nodes){const lists=currentTreeImageLists;return(nodes??[]).map(node=>{const list=node.imageListId?lists.get(node.imageListId):null;const image=node.imageItem?(list?.items??[]).find(item=>item.name===node.imageItem):null;const imageMeta=image?{imageSource:uiText(image.sourceExpr),imageWidth:Number(list?.logicalWidth)||16,imageHeight:Number(list?.logicalHeight)||16}:{};return{text:uiText(node.labelExpr),...imageMeta,children:uiTreeNodes(node.children)};});}",
  'Standalone TreeView compatibility wrapper'
);

replaceOne(
  'src/window-webapp.js',
  "function buildUIItems(nodes,lists=new Map()){const items=[];",
  "function buildUIItems(nodes,lists=new Map()){currentTreeImageLists=lists;const items=[];",
  'Standalone TreeView ImageList context'
);

replaceOne(
  'src/window-webapp.js',
  "nodes:node.control==='tree'?uiTreeNodes(node.treeNodes,lists):[],",
  "nodes:node.control==='tree'?uiTreeNodes(node.treeNodes):[],",
  'Standalone TreeView existing model hook'
);

console.log('TreeView icons compatibility fixes applied.');
