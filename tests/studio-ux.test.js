import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const base = fs.readFileSync('web/style.css', 'utf8');
const ux = fs.readFileSync('web/forms-designer.css', 'utf8');
const inspector = fs.readFileSync('web/designer-inspector.css', 'utf8');
const formsJs = fs.readFileSync('web/forms-designer.js', 'utf8');

test('Patch Studio keeps the Designer below the editor at full workspace width', () => {
  assert.match(base, /\.workspace\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
  assert.match(base, /\.result-pane\s*\{[^}]*min-height:\s*660px/s);
});

test('Patch Studio exposes visible scroll areas for code, results and Designer', () => {
  for (const marker of [
    'scrollbar-gutter: stable',
    '#code::-webkit-scrollbar',
    '.result-pane pre::-webkit-scrollbar',
    '.result-pane .app-preview::-webkit-scrollbar',
    '.designer-canvas::-webkit-scrollbar',
    'scrollbar-color: var(--border-strong) var(--surface-subtle)'
  ]) assert.ok(ux.includes(marker), marker);
  assert.ok(inspector.includes('.designer-inspector::-webkit-scrollbar'));
});

test('Designer canvas is a bounded vertical scrollport instead of growing with Forms', () => {
  for (const marker of [
    'height: clamp(640px, 78vh, 900px)',
    'overflow-y: scroll !important',
    'overscroll-behavior: contain',
    'scrollbar-gutter: stable both-edges',
    '.patch-window:last-child',
    'margin-bottom: 56px'
  ]) assert.ok(inspector.includes(marker), marker);
});

test('Designer reveals newly added Forms and controls and grows moved controls into view', () => {
  for (const marker of [
    'pendingReveal',
    'revealPendingDesignerTarget',
    'revealTarget',
    'scrollIntoView',
    'growFormForControl',
    'formControlDefaultSize'
  ]) assert.ok(formsJs.includes(marker), marker);
});

test('Designer toolbox and Form controls remain compact IDE-style controls', () => {
  for (const marker of [
    '.designer-toolbar > button',
    'min-height: 26px',
    '.forms-toolbar-group',
    '#patchAddForm::before',
    'content: "+"',
    '#patchApplyForm::before',
    'content: "✓"'
  ]) assert.ok(ux.includes(marker), marker);
});

test('Designer presents toolbox controls as a left icon rail on desktop', () => {
  for (const marker of [
    '--designer-inspector-width: 340px',
    'grid-template-columns: 54px minmax(0, 1fr) var(--designer-inspector-width)',
    '.designer-view::before',
    '#designer #addText::before',
    '#designer #addButton::before',
    '#designer #addInput::before',
    '#designer #addCheckbox::before',
    '#designer #addRadio::before',
    '#designer #addCombo::before',
    '#designer #addListbox::before',
    '#designer #addTable::before',
    '#designer #addTree::before',
    '#designer #addTabs::before'
  ]) assert.ok(inspector.includes(marker), marker);
});

test('Designer Properties panel is resizable collapsible and responsive', () => {
  for (const marker of [
    'grid-column: 3',
    'min-height: 32px',
    'position: sticky',
    'grid-template-columns: 1fr 1fr auto',
    '.designer-inspector-resize',
    '.designer-properties-collapsed',
    '@media (max-width: 1180px)',
    '@media (max-width: 760px)'
  ]) assert.ok(inspector.includes(marker), marker);
});
