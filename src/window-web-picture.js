import { validateStudioResources } from './studio-resources.js';

const RESOURCE_PREFIX = 'patch-resource:';

/**
 * Add source-backed Picture rendering to the generated standalone Window Web app.
 * Project resources remain a build concern: Patch source carries only the stable
 * patch-resource:<id> locator while the generated single-file app embeds bytes.
 */
export function addStandaloneWindowPictures(built, resources = []) {
  if (!hasPicture(built?.compiled?.ast ?? [])) return built;
  const normalized = validateStudioResources(resources);
  validateStaticPictureReferences(built.compiled.ast, normalized);

  const table = Object.fromEntries(normalized.map(resource => [resource.id, {
    mediaType: resource.mediaType,
    data: resource.data
  }]));
  const resourceJson = JSON.stringify(table).replace(/</g, '\\u003c');
  let html = String(built.html ?? '');

  const modelNeedle = "nodes:node.control==='tree'?uiTreeNodes(node.treeNodes):[],";
  if (!html.includes(modelNeedle)) throw new Error('Standalone Window Picture model hook is unavailable.');
  html = html.replace(
    modelNeedle,
    `${modelNeedle}source:node.control==='picture'&&node.sourceExpr?uiText(node.sourceExpr):'',`
  );

  const outputNeedle = "const outputEl=document.getElementById('output');";
  if (!html.includes(outputNeedle)) throw new Error('Standalone Window Picture resource hook is unavailable.');
  html = html.replace(outputNeedle, `${outputNeedle}\nconst PATCH_IMAGE_RESOURCES=Object.freeze(${resourceJson});\nfunction patchPictureSource(source){const value=String(source??'');if(!value.startsWith('${RESOURCE_PREFIX}'))return value;const id=value.slice(${RESOURCE_PREFIX.length});const resource=PATCH_IMAGE_RESOURCES[id];if(!resource)throw new PatchAppError("Picture resource '"+id+"' is not embedded in this app.");return 'data:'+resource.mediaType+';base64,'+resource.data;}`);

  const renderNeedle = "if(control.type==='tree')return renderTree(control);";
  if (!html.includes(renderNeedle)) throw new Error('Standalone Window Picture renderer hook is unavailable.');
  const pictureRenderer = "if(control.type==='picture'){const el=document.createElement('img');el.className='patch-picture';el.src=patchPictureSource(control.source);el.alt=control.text||'';const clickable=Boolean(control.id)&&events.some(handler=>handler.control===control.id&&handler.event==='clicked');if(clickable){el.tabIndex=0;el.setAttribute('role','button');const activate=()=>safeTrigger(control.id,'clicked');el.addEventListener('click',activate);el.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();activate();}});}return el;}";
  html = html.replace(renderNeedle, pictureRenderer + renderNeedle);

  const cssNeedle = '.console{padding:20px}';
  if (!html.includes(cssNeedle)) throw new Error('Standalone Window Picture stylesheet hook is unavailable.');
  html = html.replace(cssNeedle, ".patch-picture{display:block;max-width:100%;max-height:100%;object-fit:contain;border:0;background:transparent}.patch-picture[role='button']{cursor:pointer}.patch-picture[role='button']:focus-visible{outline:3px solid #2563eb;outline-offset:2px}.console{padding:20px}");

  return {
    ...built,
    html,
    metadata: {
      ...built.metadata,
      pictureStage: 1,
      pictureResourceModel: normalized.length ? 'embedded-project-resources' : 'quoted-source',
      pictureResourceCount: normalized.length
    }
  };
}

export function pictureResourceDataUri(source, resources = []) {
  const value = String(source ?? '');
  if (!value.startsWith(RESOURCE_PREFIX)) return value;
  const id = value.slice(RESOURCE_PREFIX.length);
  const resource = validateStudioResources(resources).find(item => item.id === id);
  if (!resource) throw new Error(`Picture resource '${id}' is not present in this project.`);
  return `data:${resource.mediaType};base64,${resource.data}`;
}

function validateStaticPictureReferences(ast, resources) {
  const ids = new Set(resources.map(resource => resource.id));
  walk(ast, node => {
    if (node.kind !== 'uiControl' || node.control !== 'picture') return;
    const source = quotedValue(node.sourceExpr);
    if (!source?.startsWith(RESOURCE_PREFIX)) return;
    const id = source.slice(RESOURCE_PREFIX.length);
    if (!ids.has(id)) {
      throw new Error(`line ${node.line ?? '?'}: Picture '${node.id ?? 'unnamed'}' references missing project resource '${id}'.`);
    }
  });
}

function quotedValue(expr) {
  const text = String(expr ?? '').trim();
  if (!(text.startsWith('"') && text.endsWith('"'))) return null;
  try {
    const value = JSON.parse(text);
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}

function hasPicture(nodes) {
  let found = false;
  walk(nodes, node => {
    if (node.kind === 'uiControl' && node.control === 'picture') found = true;
  });
  return found;
}

function walk(nodes, visit) {
  for (const node of nodes ?? []) {
    visit(node);
    if (node.body) walk(node.body, visit);
    if (node.thenBody) walk(node.thenBody, visit);
    if (node.elseBody) walk(node.elseBody, visit);
  }
}
