import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildStandaloneWebApp } from '../src/webapp.js';

const source = `create text status = "Ready"

window "Chrome parity" as main size 640, 420:
  panel as actions at 24, 24 size 280, 160:
    text "Quick actions"
    button "Run" as run_button
  timer as heartbeat interval 250
  statusbar "{status}" as bar

when heartbeat ticked:
  change status:
    set = "Heartbeat"
`;

test('Standalone Window Web advertises Panel, Timer and StatusBar Stage 1 parity', () => {
  const built = buildStandaloneWebApp(source, { name: 'ChromeParity', kind: 'window' });
  assert.equal(built.metadata.panelStage, 1);
  assert.equal(built.metadata.panelMode, 'source-backed-flow-group');
  assert.equal(built.metadata.timerStage, 1);
  assert.equal(built.metadata.timerMode, 'browser-interval-ticked-event');
  assert.equal(built.metadata.statusBarStage, 1);
  assert.match(built.html, /patch-panel-flow/);
  assert.match(built.html, /control\?\.type==='panel'/);
  assert.match(built.html, /control\?\.type==='timer'/);
  assert.match(built.html, /patchInstallTimers/);
  assert.match(built.html, /window\.setInterval\(\(\)=>safeTrigger\(timer\.id,'ticked'\),interval\)/);
  assert.match(built.html, /patch-statusbar/);
});

test('generated Chrome parity adapter renders Panel children and schedules only handled Timers', () => {
  const built = buildStandaloneWebApp(source, { name: 'ChromeParityRuntime', kind: 'window' });
  const scripts = [...built.html.matchAll(/<script data-patch-window-accessibility>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1);

  class FakeElement {
    constructor(tag) {
      this.tagName = String(tag).toUpperCase();
      this.children = [];
      this.attributes = new Map();
      this.dataset = {};
      this.textContent = '';
      this.className = '';
      this.tabIndex = 0;
      this.id = '';
    }
    append(...nodes) { this.children.push(...nodes); }
    appendChild(node) { this.children.push(node); return node; }
    addEventListener() {}
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    querySelector() { return null; }
    querySelectorAll() { return []; }
    closest() { return null; }
    focus() {}
  }

  const output = new FakeElement('pre');
  const document = {
    createElement(tag) { return new FakeElement(tag); },
    getElementById(id) { return id === 'output' ? output : null; },
    querySelectorAll() { return []; }
  };
  const timerCalls = [];
  const cleared = [];
  let pagehide = null;
  const window = {
    setInterval(callback, interval) { timerCalls.push({ callback, interval }); return timerCalls.length; },
    clearInterval(id) { cleared.push(id); },
    addEventListener(type, callback) { if (type === 'pagehide') pagehide = callback; }
  };
  const context = vm.createContext({ document, window, console });
  vm.runInContext(`
var PROGRAM=[{kind:'window',body:[
  {kind:'uiControl',control:'panel',id:'actions',body:[
    {kind:'uiControl',control:'text',id:null,textExpr:'"Quick actions"'},
    {kind:'uiControl',control:'button',id:'run_button',textExpr:'"Run"'}
  ]},
  {kind:'uiControl',control:'timer',id:'heartbeat',interval:250},
  {kind:'uiControl',control:'timer',id:'unused_timer',interval:100},
  {kind:'uiControl',control:'statusbar',id:'bar',textExpr:'"Ready"'}
]}];
var events=[{control:'heartbeat',event:'ticked'}];
var state=new Map();
var triggered=[];
var rendered=null;
function uiText(expr){return String(expr||'').replace(/^"|"$/g,'');}
function buildUIItems(nodes){return (nodes||[]).filter(node=>node.kind==='uiControl').map(node=>({type:node.control,id:node.id,text:node.textExpr?uiText(node.textExpr):'',options:[],value:''}));}
function renderControl(control){const el=document.createElement('div');el.textContent=control.text||control.id||'';return el;}
function render(){rendered=renderControl(buildUIItems(PROGRAM[0].body)[0],'main',0);}
function safeTrigger(control,event,payload){triggered.push({control,event,payload});}
`, context);
  vm.runInContext(scripts[0][1], context, { timeout: 1000 });

  assert.equal(context.rendered.tagName, 'SECTION');
  assert.equal(context.rendered.className, 'patch-panel');
  const flow = context.rendered.children.find(child => child.className === 'patch-panel-flow');
  assert.ok(flow);
  assert.equal(flow.children.length, 2);
  assert.equal(timerCalls.length, 1, 'Timer without a ticked handler must not be scheduled');
  assert.equal(timerCalls[0].interval, 250);
  timerCalls[0].callback();
  assert.equal(context.triggered.length, 1);
  assert.equal(context.triggered[0].control, 'heartbeat');
  assert.equal(context.triggered[0].event, 'ticked');
  assert.equal(cleared.length, 0);
  assert.equal(typeof pagehide, 'function');
  pagehide();
  assert.deepEqual(cleared, [1]);
});

test('generated Chrome adapter resolves control types recursively inside Panel children', () => {
  const built = buildStandaloneWebApp(`create number level = 2
window "Nested" as main size 480, 300:
  panel as controls at 24, 24 size 300, 180:
    slider 0..10 as level step 1
when level changed:
  change level:
    set = value
`, { name: 'NestedPanelType', kind: 'window' });
  const script = [...built.html.matchAll(/<script data-patch-window-accessibility>([\s\S]*?)<\/script>/g)][0]?.[1];
  assert.ok(script);

  const output = { setAttribute() {} };
  const document = { getElementById() { return output; }, querySelectorAll() { return []; }, createElement() { return { append() {}, appendChild() {}, setAttribute() {}, addEventListener() {} }; } };
  const window = { setInterval() { return 1; }, clearInterval() {}, addEventListener() {} };
  const context = vm.createContext({ document, window, console });
  vm.runInContext(`
var PROGRAM=[{kind:'window',body:[{kind:'uiControl',control:'panel',id:'controls',body:[{kind:'uiControl',control:'slider',id:'level',min:0,max:10,step:1}]}]}];
var events=[];
var state=new Map([['level',2]]);
function buildUIItems(nodes){return (nodes||[]).filter(node=>node.kind==='uiControl').map(node=>({type:node.control,id:node.id,text:'',options:[],value:node.id&&state.has(node.id)?state.get(node.id):''}));}
function controlType(){return null;}
function renderControl(){return null;}
function render(){}
function trigger(){return null;}
function safeTrigger(){}
`, context);
  vm.runInContext(script, context, { timeout: 1000 });
  assert.equal(vm.runInContext(`controlType('level')`, context), 'slider');
});
