import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse } from '../src/parser.js';
import { compile } from '../src/compiler.js';
import { PatchInterpreter } from '../src/interpreter.js';
import { buildStandaloneWebApp } from '../src/webapp.js';
import { buildCurrentNativeGuiIR } from '../src/native-current-contract.js';
import { collectWindowLinkLabelIds, readWindowButtonPresentation, setWindowButtonPresentation } from '../src/button-presentation.js';

const SOURCE = `window "Links" as main size 520, 300:
  # @button-mode link
  button "Open details" as details at 24, 24 size 180, 32
when details clicked:
  show "clicked"
`;

test('LinkLabel metadata round-trips on an ordinary Button', () => {
  const plain = `window "Links":\n  button "Open" as details\n`;
  const linked = setWindowButtonPresentation(plain, 2, 'link');
  assert.match(linked, /# @button-mode link/);
  assert.equal(readWindowButtonPresentation(linked, 3), 'link');
  assert.equal(setWindowButtonPresentation(linked, 3, 'plain'), plain);
});

test('LinkLabel discovery follows Buttons through Tabs and Panels and rejects wrong controls', () => {
  const nested = `window "Nested":
  # @button-mode link
  button "Top" as top_link
  tabs as pages:
    tab "One":
      # @button-mode link
      button "Tab" as tab_link
    tab "Two":
      text "Other"
  panel as holder:
    # @button-mode link
    button "Panel" as panel_link
`;
  assert.deepEqual(collectWindowLinkLabelIds(nested, parse(nested)), ['top_link','tab_link','panel_link']);
  assert.throws(() => compile(`window "Bad":\n  # @button-mode link\n  input value\n`, { kind: 'window' }), /belongs only to Button controls/);
});

test('LinkLabel compile preserves ordinary Button, clicked event and Change IR 0.10', () => {
  const compiled = compile(SOURCE, { name: 'Links', kind: 'window' });
  const button = compiled.ast.find(node => node.kind === 'window').body.find(node => node.control === 'button');
  assert.equal(compiled.ir.version, '0.10');
  assert.equal(compiled.windowButtonPresentation.version, '0.1');
  assert.equal(button.control, 'button');
  assert.equal(button.buttonPresentation, 'link');
  const runtime = new PatchInterpreter();
  runtime.run(SOURCE);
  assert.deepEqual(runtime.trigger('details','clicked').output, ['clicked']);
});

test('Standalone Web renders LinkLabel as a styled Button without implicit href navigation', () => {
  const built = buildStandaloneWebApp(SOURCE, { name: 'Links', kind: 'window' });
  assert.equal(built.metadata.linkLabelStage, 1);
  assert.equal(built.metadata.linkLabelVersion, '0.1');
  assert.equal(built.metadata.linkLabelMode, 'source-backed-button-presentation');
  assert.equal(built.metadata.linkLabelEvent, 'clicked');
  assert.match(built.html, /patch-linklabel/);
  assert.match(built.html, /patchButtonPresentation='link'/);
  assert.doesNotMatch(built.html, /href=.*details/);
});

test('Current Ready native rejects LinkLabel explicitly while plain Button remains compatible', () => {
  assert.throws(() => buildCurrentNativeGuiIR(compile(SOURCE, { name: 'Links', kind: 'window' })), /LinkLabel Stage 1.*Studio\/Web only.*Current Ready native 1\.10/i);
  const plain = compile(`create text result = "idle"\nwindow "Plain":\n  button "Open" as details\nwhen details clicked:\n  change result:\n    set = "clicked"\n`, { name: 'Plain', kind: 'window' });
  assert.doesNotThrow(() => buildCurrentNativeGuiIR(plain));
});

test('Studio exposes LinkLabel palette and Inspector and renderer preserves Button semantics', () => {
  const module = fs.readFileSync('src/button-presentation.js','utf8');
  const renderer = fs.readFileSync('web/studio-window-renderer.js','utf8');
  assert.match(module, /button\.id = 'addLinkLabel'/);
  assert.match(module, /button\.textContent = '\+ LinkLabel'/);
  assert.match(module, /option value="link">LinkLabel<\/option>/);
  assert.match(module, /keeps the ordinary Button clicked event/);
  assert.match(renderer, /control\.buttonPresentation === 'link'/);
  assert.match(renderer, /patch-button patch-linklabel/);
});

test('LinkLabel source metadata participates in generic designer duplicate and clipboard lifecycle', () => {
  for (const path of ['src/designer.js','src/window-layout-policy.js','web/designer-control-duplicate-model.js','web/designer-control-clipboard-model.js']) {
    assert.match(fs.readFileSync(path,'utf8'), /button-mode/, path);
  }
});
