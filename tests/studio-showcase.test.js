import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  PATCH_STUDIO_PROJECT_VERSION,
  composeStudioProjectSource,
  parseStudioProjectBundle
} from '../src/studio-project.js';
import {
  PATCH_COMPONENT_REGISTRY_VERSION,
  PATCH_COMPONENTS
} from '../src/component-registry.js';
import { compile } from '../src/compiler.js';
import { buildStandaloneWebApp } from '../src/webapp.js';

const PROJECT_PATH = 'examples/patch-studio-showcase.patchproject';
const SOURCE_DIR = 'examples/patch-studio-showcase';
const bundle = parseStudioProjectBundle(fs.readFileSync(PROJECT_PATH, 'utf8'));
const composition = composeStudioProjectSource(bundle);

function collectComponentTypes(nodes, out = new Set()) {
  for (const node of nodes ?? []) {
    if (node?.kind === 'uiControl') out.add(node.control);
    if (node?.kind === 'tabs') out.add('tabs');
    if (node?.body) collectComponentTypes(node.body, out);
    if (node?.thenBody) collectComponentTypes(node.thenBody, out);
    if (node?.elseBody) collectComponentTypes(node.elseBody, out);
  }
  return out;
}

function collectKinds(nodes, out = new Set()) {
  for (const node of nodes ?? []) {
    if (node?.kind) out.add(node.kind);
    if (node?.body) collectKinds(node.body, out);
    if (node?.thenBody) collectKinds(node.thenBody, out);
    if (node?.elseBody) collectKinds(node.elseBody, out);
  }
  return out;
}

function webReadyShowcaseSlice() {
  const main = bundle.files.find(file => file.path === 'main.patch')?.content ?? '';
  const forms = bundle.files.find(file => file.path === 'forms.patch')?.content ?? '';
  const withoutMenus = main.replace(
    /\n  menu "File":[\s\S]*?\n\n  # @locked/,
    '\n  # @locked'
  );
  assert.doesNotMatch(withoutMenus, /^\s*menu\b/m, 'Web-ready Showcase slice must not silently retain unsupported Menu nodes');
  return `${withoutMenus}\n${forms}\nwhen gallery_canvas paint:\n  draw clear #f8fafc\n  draw image "patch-resource:showcase.logo" at 16, 16 size 48, 48\n`;
}

test('Patch Studio Showcase is a canonical current project-v4 multi-file fixture', () => {
  assert.equal(bundle.version, PATCH_STUDIO_PROJECT_VERSION);
  assert.equal(bundle.project.name, 'Patch Studio Showcase');
  assert.equal(bundle.project.kind, 'window');
  assert.equal(bundle.project.entry, 'main.patch');
  assert.equal(bundle.project.build.target, 'web');
  assert.equal(bundle.files.length, 3);
  assert.equal(bundle.resources.length, 1);
  assert.equal(bundle.resources[0].id, 'showcase.logo');
  assert.equal(bundle.resources[0].mediaType, 'image/png');

  for (const file of bundle.files) {
    const canonicalSource = fs.readFileSync(path.join(SOURCE_DIR, file.path), 'utf8');
    assert.equal(file.content, canonicalSource, `${file.path} inside the .patchproject must stay synchronized with the readable showcase source`);
  }
});

test('Patch Studio Showcase preserves a presentation-ready dashboard hierarchy instead of a control dump', () => {
  const main = fs.readFileSync(path.join(SOURCE_DIR, 'main.patch'), 'utf8');
  const forms = fs.readFileSync(path.join(SOURCE_DIR, 'forms.patch'), 'utf8');

  assert.match(main, /window "Patch Studio Showcase" as main size 1180, 820/);
  for (const card of ['hero_card', 'account_card', 'preference_card', 'details_card']) {
    assert.match(main, new RegExp(`shape rounded as ${card}`));
  }
  assert.match(main, /panel as actions_panel at 780, 436 size 376, 318/);
  assert.match(main, /text "Account & input"/);
  assert.match(main, /text "Preferences & state"/);
  assert.match(main, /text "Details & semantics"/);
  assert.match(main, /text "Quick actions"/);
  assert.doesNotMatch(main, /text "Input presentations"/);
  assert.doesNotMatch(main, /text "Choices and state"/);

  assert.match(forms, /window "Component Gallery" as components size 1080, 760/);
  for (const card of ['gallery_header', 'data_card', 'graphics_card', 'resources_card']) {
    assert.match(forms, new RegExp(`shape rounded as ${card}`));
  }
  assert.match(forms, /# @panel-mode group\n  panel as gallery_panel at 708, 446 size 348, 220:\n    # @panel-scroll auto/);
  assert.match(forms, /row "GroupBox", "Panel presentation", "Studio\/Web"/);
  assert.match(forms, /row "ScrollBox", "Panel auto-scroll", "Studio\/Web"/);
  assert.match(forms, /button "Dialog Lab" as gallery_dialogs at 182, 210 size 148, 40/);
  assert.match(forms, /window "Dialog Lab" as dialogs size 820, 560/);
  for (const card of ['dialog_header', 'dialog_actions_card', 'dialog_path_card']) {
    assert.match(forms, new RegExp(`shape rounded as ${card}`));
  }
});

test('Patch Studio Showcase intentionally tracks the complete current Component Registry', () => {
  assert.match(composition.source, new RegExp(`Component Registry ${PATCH_COMPONENT_REGISTRY_VERSION.replace('.', '\\.')}`));
  const compiled = compile(composition.source, { name: bundle.project.name, kind: 'window', entry: bundle.project.entry });
  const represented = collectComponentTypes(compiled.ast);
  const missing = PATCH_COMPONENTS.map(component => component.type).filter(type => !represented.has(type));
  assert.deepEqual(missing, [], `Update Patch Studio Showcase for new registry controls: ${missing.join(', ')}`);

  assert.match(composition.source, /# @input-mode password/);
  assert.match(composition.source, /# @input-mask "\(000\) 000-0000"/);
  assert.match(composition.source, /# @input-mask "AA-000"/);
  assert.match(composition.source, /# @listbox-mode checked/);
  assert.match(composition.source, /# @slider-mode progress/);
  assert.match(composition.source, /# @panel-mode group/);
  assert.match(composition.source, /# @panel-scroll auto/);
  assert.match(composition.source, /# @taborder 0/);
  assert.match(composition.source, /# @locked/);
  assert.match(composition.source, /# @layout anchor right bottom/);
  assert.equal(compiled.windowInputPresentation.controls.some(control => control.mode === 'password'), true);
  assert.equal(compiled.windowInputMask.controls.length >= 2, true);
  assert.equal(compiled.windowListboxPresentation.controls.some(control => control.mode === 'checked'), true);
  assert.equal(compiled.windowSliderPresentation.controls.some(control => control.mode === 'progress' && control.id === 'completion'), true);
  assert.equal(compiled.windowPanelPresentation.controls.some(control => control.mode === 'group' && control.id === 'gallery_panel'), true);
  assert.equal(compiled.windowPanelScroll.controls.some(control => control.mode === 'auto' && control.id === 'gallery_panel'), true);
});

test('Patch Studio Showcase covers structural RAD, dialogs, resources and explicit event semantics', () => {
  const compiled = compile(composition.source, { name: bundle.project.name, kind: 'window', entry: bundle.project.entry });
  const kinds = collectKinds(compiled.ast);
  for (const kind of ['window', 'menu', 'menuItem', 'menuSeparator', 'dialog', 'confirmDialog', 'openFileDialog', 'saveFileDialog', 'event', 'openForm', 'closeForm']) {
    assert.equal(kinds.has(kind), true, `Showcase must retain ${kind} coverage`);
  }

  assert.match(composition.source, /shortcut "Primary\+O"/);
  assert.match(composition.source, /enabled can_save/);
  assert.match(composition.source, /checked pinned/);
  assert.match(composition.source, /patch-resource:showcase\.logo/);
  assert.match(composition.source, /button "Component Gallery" as open_gallery image showcase_images\.mark/);
  assert.match(composition.source, /draw image "patch-resource:showcase\.logo"/);
  assert.match(composition.source, /when .* changed:\n  change /);
  assert.match(composition.source, /when .* clicked:/);
  assert.match(composition.source, /when showcase_clock ticked:\n  change ticks:[\s\S]*?change completion:/);
  assert.doesNotMatch(composition.source, /when completion changed:/);
  assert.doesNotMatch(composition.source, /when gallery_panel scrolled:/);
  assert.match(composition.source, /when gallery_canvas paint:/);
});

test('complete Showcase preserves explicit fail-closed export boundaries instead of hiding unsupported target features', () => {
  assert.throws(
    () => buildStandaloneWebApp(composition.source, {
      name: bundle.project.name,
      kind: bundle.project.kind,
      entry: bundle.project.entry,
      resources: bundle.resources
    }),
    /Menu decorations|Standalone Window Web App does not yet support:.*menu/i
  );
});

test('Web-compatible Showcase slice packages every current Studio/Web-only R4 surface and resources', () => {
  const built = buildStandaloneWebApp(webReadyShowcaseSlice(), {
    name: `${bundle.project.name} Web Surface`,
    kind: 'window',
    entry: bundle.project.entry,
    resources: bundle.resources
  });

  assert.equal(built.metadata.projectKind, 'window');
  assert.equal(built.metadata.memoStage, 1);
  assert.equal(built.metadata.passwordEditStage, 1);
  assert.equal(built.metadata.maskedEditStage, 1);
  assert.equal(built.metadata.checkedListBoxStage, 1);
  assert.equal(built.metadata.progressBarStage, 1);
  assert.equal(built.metadata.progressBarMode, 'passive-number-state-presentation');
  assert.equal(built.metadata.groupBoxStage, 1);
  assert.equal(built.metadata.groupBoxMode, 'source-backed-panel-presentation');
  assert.equal(built.metadata.scrollBoxStage, 1);
  assert.equal(built.metadata.scrollBoxMode, 'source-backed-panel-auto-scroll');
  assert.match(built.html, /createElement\('textarea'\)/);
  assert.match(built.html, /data-patch-window-passwordedit/);
  assert.match(built.html, /data-patch-window-maskededit/);
  assert.match(built.html, /data-patch-window-checkedlistbox/);
  assert.match(built.html, /data-patch-window-progressbar/);
  assert.match(built.html, /createElement\('progress'\)/);
  assert.match(built.html, /patch-groupbox/);
  assert.match(built.html, /patch-scrollbox/);
  assert.match(built.html, /patchPanelScrollExtent/);
  assert.match(built.html, /rel="icon"/);
  assert.match(built.html, /data:image\/png;base64/);
  assert.match(built.html, /PATCH_IMAGE_RESOURCES/);
});
