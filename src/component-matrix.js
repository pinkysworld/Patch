import { PATCH_COMPONENT_REGISTRY_VERSION, PATCH_COMPONENTS } from './component-registry.js';
import {
  PATCH_CURRENT_NATIVE_CONTRACT_ID,
  PATCH_CURRENT_NATIVE_GUI_IR_VERSION,
  PATCH_CURRENT_NATIVE_PAYLOAD_VERSION,
  PATCH_CURRENT_NATIVE_RUNTIME_VERSION
} from './native-current-contract.js';

export const PATCH_COMPONENT_MATRIX_SCHEMA = 'patch-components';
export const PATCH_COMPONENT_MATRIX_VERSION = 1;

const TARGETS = Object.freeze(['studio', 'web', 'windows', 'macos', 'linux', 'freebsd']);

export function patchComponentCapabilityMatrix() {
  return Object.freeze({
    schema: PATCH_COMPONENT_MATRIX_SCHEMA,
    version: PATCH_COMPONENT_MATRIX_VERSION,
    registryVersion: PATCH_COMPONENT_REGISTRY_VERSION,
    contract: Object.freeze({
      id: PATCH_CURRENT_NATIVE_CONTRACT_ID,
      changeIR: '0.10',
      nativeGuiIR: PATCH_CURRENT_NATIVE_GUI_IR_VERSION,
      payload: PATCH_CURRENT_NATIVE_PAYLOAD_VERSION,
      runtime: PATCH_CURRENT_NATIVE_RUNTIME_VERSION
    }),
    generatedFrom: 'src/component-registry.js',
    components: Object.freeze(PATCH_COMPONENTS.map(component => Object.freeze({
      type: component.type,
      label: component.label,
      category: component.category,
      visual: component.visual,
      properties: Object.freeze(component.properties.map(property => property.name)),
      events: Object.freeze(component.events.map(event => event.name)),
      targets: Object.freeze({ ...component.targetSupport })
    })))
  });
}

export function formatPatchComponentCapabilityMatrixText(matrix = patchComponentCapabilityMatrix()) {
  const rows = [
    `Patch components  registry ${matrix.registryVersion}  ${matrix.contract.id}`,
    ['type', 'category', 'visual', ...TARGETS].map(pad).join(''),
    ...matrix.components.map(component => [
      component.type,
      component.category,
      component.visual ? 'visual' : 'nonvisual',
      ...TARGETS.map(target => component.targets[target] ?? 'unknown')
    ].map(pad).join(''))
  ];
  return `${rows.join('\n')}\n`;
}

export function formatPatchComponentCapabilityMatrixMarkdown(matrix = patchComponentCapabilityMatrix()) {
  const header = [
    '# Component capability matrix',
    '',
    `Generated from \`${matrix.generatedFrom}\` registry **${matrix.registryVersion}**. Do not edit the table by hand; run \`node scripts/generate-component-matrix.js\`.`,
    '',
    `Current product contract: Change IR **${matrix.contract.changeIR}**, Native GUI IR **${matrix.contract.nativeGuiIR}**, sealed payload **v${matrix.contract.payload}**, runtime **v${matrix.contract.runtime}** (\`${matrix.contract.id}\`).`,
    '',
    'Status values come from the canonical Designer registry:',
    '',
    '- `supported` — implemented and claimed for that target',
    '- `authoring` — Patch Studio can create/edit the control; runtime support is not claimed',
    '- `unsupported` — the target must fail closed',
    '',
    'Studio authoring is not native or Web runtime parity. A blank runtime claim is a defect.',
    '',
    '| Type | Label | Category | Kind | Studio | Web | Windows | macOS | Linux | FreeBSD | Properties | Events |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|'
  ];

  const rows = matrix.components.map(component => {
    const kind = component.visual ? 'visual' : 'nonvisual';
    const properties = component.properties.join(', ') || '—';
    const events = component.events.join(', ') || '—';
    const cells = TARGETS.map(target => component.targets[target] ?? 'unknown');
    return `| \`${component.type}\` | ${component.label} | ${component.category} | ${kind} | ${cells.join(' | ')} | ${properties} | ${events} |`;
  });

  return `${[...header, ...rows, ''].join('\n')}`;
}

function pad(value) {
  return String(value).padEnd(14);
}
