import { PatchInterpreter } from '../src/interpreter.js';
import { compile } from '../src/compiler.js';
import { triggerWindowEvent } from '../src/window-events.js';

export const PATCH_STUDIO_RUN_CONTROLLER_VERSION = '0.1';

export function createStudioRunLifecycle(options = {}) {
  const source = requiredFunction(options.source, 'source');
  const projectOptions = requiredFunction(options.projectOptions, 'projectOptions');
  const onBusyChange = optionalFunction(options.onBusyChange);
  const onRunSuccess = optionalFunction(options.onRunSuccess);
  const onRunError = optionalFunction(options.onRunError);
  const onEventSuccess = optionalFunction(options.onEventSuccess);
  const onEventError = optionalFunction(options.onEventError);
  const compileProgram = options.compileProgram ?? compile;
  const createRuntime = options.createRuntime ?? (() => new PatchInterpreter());
  const triggerEvent = options.triggerEvent ?? triggerWindowEvent;
  const schedule = options.schedule ?? (callback => setTimeout(callback, 0));

  requiredFunction(compileProgram, 'compileProgram');
  requiredFunction(createRuntime, 'createRuntime');
  requiredFunction(triggerEvent, 'triggerEvent');
  requiredFunction(schedule, 'schedule');

  let runtime = null;
  let pendingIr = null;
  let running = false;

  function run() {
    if (running) return false;
    running = true;
    onBusyChange(true);
    try {
      schedule(executeRunProject);
    } catch (error) {
      running = false;
      onBusyChange(false);
      throw error;
    }
    return true;
  }

  function executeRunProject() {
    try {
      const compiled = compileProgram(source(), projectOptions());
      const nextRuntime = createRuntime();
      const result = nextRuntime.runAst(compiled.ast);
      runtime = nextRuntime;
      pendingIr = compiled.ir;
      onRunSuccess(result, compiled);
    } catch (error) {
      runtime = null;
      pendingIr = null;
      onRunError(error);
    } finally {
      running = false;
      onBusyChange(false);
    }
  }

  function trigger(control, event, payload = {}) {
    if (!runtime) return false;
    try {
      const result = triggerEvent(runtime, control, event, payload);
      onEventSuccess(result);
      return true;
    } catch (error) {
      onEventError(error);
      return false;
    }
  }

  function takePendingIr() {
    const ir = pendingIr;
    pendingIr = null;
    return ir;
  }

  return Object.freeze({
    run,
    trigger,
    takePendingIr,
    get running() { return running; },
    get started() { return Boolean(runtime); }
  });
}

export function installStudioRunController(options = {}) {
  const doc = options.document ?? globalThis.document ?? null;
  const code = options.code ?? doc?.querySelector?.('#code') ?? null;
  const runButton = options.runButton ?? doc?.querySelector?.('#run') ?? null;
  const output = options.output ?? doc?.querySelector?.('#output') ?? null;
  const changesView = options.changesView ?? doc?.querySelector?.('#changes') ?? null;
  const irView = options.irView ?? doc?.querySelector?.('#ir') ?? null;
  const projectOptions = requiredFunction(options.projectOptions, 'projectOptions');
  const formatChangeAnalysis = requiredFunction(options.formatChangeAnalysis, 'formatChangeAnalysis');
  const formatStudioStop = requiredFunction(options.formatStudioStop, 'formatStudioStop');
  const showTab = requiredFunction(options.showTab, 'showTab');
  const renderInitial = requiredFunction(options.renderInitial, 'renderInitial');
  const renderAfterEvent = requiredFunction(options.renderAfterEvent, 'renderAfterEvent');
  const renderFailure = optionalFunction(options.renderFailure);

  if (!code || !runButton || !output || !changesView || !irView) {
    throw new Error('Patch Studio Run controller requires the Run, source, output, changes and IR surfaces.');
  }

  const lifecycle = createStudioRunLifecycle({
    source: () => code.value,
    projectOptions,
    compileProgram: options.compileProgram,
    createRuntime: options.createRuntime,
    triggerEvent: options.triggerEvent,
    schedule: options.schedule,
    onBusyChange(busy) {
      if (busy) runButton.setAttribute?.('aria-busy', 'true');
      else runButton.removeAttribute?.('aria-busy');
      runButton.disabled = busy;
    },
    onRunSuccess(result, compiled) {
      output.textContent = result.output.length ? result.output.join('\n') : '(program finished with no console output)';
      changesView.textContent = formatChangeAnalysis(compiled.ir);
      renderInitial(result.ui);
      showTab(result.ui.length ? 'app' : 'output');
    },
    onRunError(error) {
      output.textContent = `Patch stopped:\n${formatStudioStop(error, 'run')}`;
      changesView.textContent = `Change contract unavailable:\n${error.message}`;
      renderFailure(error);
      showTab('output');
    },
    onEventSuccess(result) {
      output.textContent = result.output.length ? result.output.join('\n') : '(event completed)';
      renderAfterEvent(result.ui);
    },
    onEventError(error) {
      output.textContent = `Patch stopped:\n${formatStudioStop(error, 'run')}`;
      showTab('output');
    }
  });

  runButton.addEventListener?.('click', lifecycle.run);

  function refreshIrView() {
    const ir = lifecycle.takePendingIr();
    if (!ir) return false;
    irView.textContent = JSON.stringify(ir, null, 2);
    return true;
  }

  return Object.freeze({
    run: lifecycle.run,
    trigger: lifecycle.trigger,
    refreshIrView,
    lifecycle
  });
}

function requiredFunction(value, name) {
  if (typeof value !== 'function') throw new TypeError(`Patch Studio Run controller requires ${name}().`);
  return value;
}

function optionalFunction(value) {
  return typeof value === 'function' ? value : () => {};
}
