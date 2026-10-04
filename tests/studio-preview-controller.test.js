import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  PATCH_STUDIO_PREVIEW_CONTROLLER_VERSION,
  PATCH_STUDIO_PREVIEW_DEBOUNCE_MS,
  createStudioPreviewLifecycle
} from '../web/studio-preview-controller.js';

test('Studio Preview controller exposes a bounded versioned lifecycle surface', () => {
  assert.equal(PATCH_STUDIO_PREVIEW_CONTROLLER_VERSION, '0.1');
  assert.equal(PATCH_STUDIO_PREVIEW_DEBOUNCE_MS, 220);
  execFileSync(process.execPath, ['--check', 'web/studio-preview-controller.js'], { stdio: 'pipe' });
  const source = fs.readFileSync('web/studio-preview-controller.js', 'utf8');
  assert.doesNotMatch(source, /^const document\s*=/m);
  assert.match(source, /createStudioLanguageClient/);
  assert.match(source, /createStudioFormMaterializationPlan/);
});

test('Preview lifecycle owns Designer materialization and Change Contract presentation', async () => {
  const designer = [];
  const changes = [];
  const lifecycle = createStudioPreviewLifecycle({
    languageClient: {
      async designModel() {
        return { ui: [{ id: 'first' }, { id: 'second' }] };
      },
      async compile() {
        return { ir: { changeSignatures: {} } };
      }
    },
    readSource: () => 'window "Preview":',
    languageProjectOptions: () => ({ kind: 'window' }),
    formatChangeAnalysis: ir => `changes:${Object.keys(ir.changeSignatures).length}`,
    getSelectedFormIndex: () => 1,
    onDesignerModel: (ui, options) => designer.push({ ui, options }),
    onChangeContract: text => changes.push(text),
    disposeLanguageClient: false
  });

  assert.equal(await lifecycle.refreshDesigner(), true);
  assert.equal(designer.length, 1);
  assert.equal(designer[0].options.materialization.activeIndex, 1);
  assert.deepEqual(designer[0].options.materialization.modes, ['shell', 'full']);
  assert.equal(await lifecycle.refreshChangeContract(), true);
  assert.deepEqual(changes, ['changes:0']);
});

test('stale Designer results never replace a newer source revision', async () => {
  let source = 'first';
  let resolveFirst;
  let calls = 0;
  const rendered = [];
  const lifecycle = createStudioPreviewLifecycle({
    languageClient: {
      designModel() {
        calls += 1;
        if (calls === 1) return new Promise(resolve => { resolveFirst = resolve; });
        return Promise.resolve({ ui: [{ id: 'new' }] });
      },
      compile: async () => ({ ir: {} })
    },
    readSource: () => source,
    onDesignerModel: ui => rendered.push(ui.map(item => item.id)),
    disposeLanguageClient: false
  });

  const first = lifecycle.refreshDesigner();
  source = 'second';
  const second = lifecycle.refreshDesigner();
  assert.equal(await second, true);
  resolveFirst({ ui: [{ id: 'old' }] });
  assert.equal(await first, false);
  assert.deepEqual(rendered, [['new']]);
});

test('preview scheduling is bounded and coalesces repeated edits', () => {
  const scheduled = [];
  const cancelled = [];
  let nextHandle = 1;
  const lifecycle = createStudioPreviewLifecycle({
    languageClient: {
      designModel: async () => ({ ui: [] }),
      compile: async () => ({ ir: {} })
    },
    readSource: () => '',
    schedule(callback, delay) {
      const handle = nextHandle++;
      scheduled.push({ handle, callback, delay });
      return handle;
    },
    cancelSchedule: handle => cancelled.push(handle),
    disposeLanguageClient: false
  });

  lifecycle.scheduleDesigner();
  lifecycle.scheduleDesigner();
  lifecycle.scheduleChangeContract();
  lifecycle.scheduleChangeContract();

  assert.equal(scheduled.length, 4);
  assert.deepEqual(cancelled, [1, 3]);
  assert.ok(scheduled.every(item => item.delay === PATCH_STUDIO_PREVIEW_DEBOUNCE_MS));
  lifecycle.dispose();
  assert.deepEqual(cancelled, [1, 3, 2, 4]);
});
