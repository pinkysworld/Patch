import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const base = fs.readFileSync('web/style.css', 'utf8');
const ux = fs.readFileSync('web/forms-designer.css', 'utf8');

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
