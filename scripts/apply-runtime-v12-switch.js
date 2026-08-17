#!/usr/bin/env node
import fs from 'node:fs';

function read(file) { return fs.readFileSync(file, 'utf8'); }
function write(file, text) { fs.writeFileSync(file, text); }
function replaceExact(file, from, to, expected = 1) {
  const text = read(file);
  const count = text.split(from).length - 1;
  if (count !== expected) throw new Error(`${file}: expected ${expected} occurrences of ${JSON.stringify(from)}, found ${count}`);
  write(file, text.split(from).join(to));
}
function replaceAtLeast(file, from, to, minimum = 1) {
  const text = read(file);
  const count = text.split(from).length - 1;
  if (count < minimum) throw new Error(`${file}: expected at least ${minimum} occurrences of ${JSON.stringify(from)}, found ${count}`);
  write(file, text.split(from).join(to));
}
function appendOnce(file, marker, addition) {
  const text = read(file);
  if (text.includes(addition.trim())) return;
  const index = text.indexOf(marker);
  if (index < 0) throw new Error(`${file}: append marker not found: ${marker}`);
  write(file, `${text.slice(0, index)}${addition}${text.slice(index)}`);
}

// Current Window linking: Native GUI IR 1.1 -> sealed payload v11/runtime v1.2.
replaceExact('src/offline-linker.js',
  "import { PATCH_SEALED_NATIVE_GUI_LIST_VERSION, sealNativeGuiRuntime } from './sealed-native-gui.js';",
  "import { sealNativeGuiRuntimeV11 } from './sealed-native-gui-v11.js';");
replaceExact('src/offline-linker.js',
  "const sealed = sealNativeGuiRuntime(runtime, nativeGui, { platform, version: PATCH_SEALED_NATIVE_GUI_LIST_VERSION });",
  "const sealed = sealNativeGuiRuntimeV11(runtime, nativeGui, { platform });");

// Package helpers use v11 for the new current payload while keeping explicit <=v10 callers on the frozen encoder.
replaceExact('src/sealed-native-package.js',
  "import { sealNativeGuiRuntime } from './sealed-native-gui.js';",
  "import { sealNativeGuiRuntime } from './sealed-native-gui.js';\nimport { PATCH_SEALED_NATIVE_GUI_MENU_VERSION, sealNativeGuiRuntimeV11 } from './sealed-native-gui-v11.js';");
replaceExact('src/sealed-native-package.js',
  "const sealed = sealNativeGuiRuntime(runtime, nativeGui, { platform: 'linux', version: options.payloadVersion });",
  "const sealed = sealNativeGuiPackageRuntime(runtime, nativeGui, { platform: 'linux', payloadVersion: options.payloadVersion });");
replaceExact('src/sealed-native-package.js',
  "const sealed = sealNativeGuiRuntime(runtime, nativeGui, { platform: 'macos', version: options.payloadVersion });",
  "const sealed = sealNativeGuiPackageRuntime(runtime, nativeGui, { platform: 'macos', payloadVersion: options.payloadVersion });");
appendOnce('src/sealed-native-package.js', 'function infoPlist(name) {', `function sealNativeGuiPackageRuntime(runtime, nativeGui, { platform, payloadVersion }) {\n  if (Number(payloadVersion) === PATCH_SEALED_NATIVE_GUI_MENU_VERSION) {\n    return sealNativeGuiRuntimeV11(runtime, nativeGui, { platform });\n  }\n  return sealNativeGuiRuntime(runtime, nativeGui, { platform, version: payloadVersion });\n}\n\n`);

// Browser Ready builds now seal v11; compatibility packaging remains separate.
replaceExact('web/native-build.js',
  "import { PATCH_SEALED_NATIVE_GUI_LIST_VERSION, sealNativeGuiRuntime } from '../src/sealed-native-gui.js';",
  "import { PATCH_SEALED_NATIVE_GUI_MENU_VERSION, sealNativeGuiRuntimeV11 } from '../src/sealed-native-gui-v11.js';");
replaceExact('web/native-build.js',
  "const sealed = sealNativeGuiRuntime(runtimeBytes, nativeGui, { version: PATCH_SEALED_NATIVE_GUI_LIST_VERSION });",
  "const sealed = sealNativeGuiRuntimeV11(runtimeBytes, nativeGui, { platform: 'windows' });");
replaceAtLeast('web/native-build.js', 'PATCH_SEALED_NATIVE_GUI_LIST_VERSION', 'PATCH_SEALED_NATIVE_GUI_MENU_VERSION', 2);

// Browser bundle must ship the v11 sealer module.
replaceExact('scripts/build-site.js',
  "'window-compiled.js','native-gui-ir.js','native-gui-ir-v08.js','native-gui-ir-v09.js','native-gui-ir-v10.js','native-gui-ir-v11.js','sealed-native-gui.js','sealed-native-package.js'",
  "'window-compiled.js','native-gui-ir.js','native-gui-ir-v08.js','native-gui-ir-v09.js','native-gui-ir-v10.js','native-gui-ir-v11.js','sealed-native-gui.js','sealed-native-gui-v11.js','sealed-native-package.js'");

// Direct seal scripts accept v11 while retaining their older explicit payload modes.
for (const [file, platform, oldCall] of [
  ['scripts/seal-native-win32.js', 'windows', 'sealNativeGuiRuntime(runtime, gui, { version: payloadVersion })'],
  ['scripts/seal-native-linux.js', 'linux', "sealNativeGuiRuntime(runtime, gui, { platform: 'linux', version: payloadVersion })"],
  ['scripts/seal-native-macos.js', 'macos', "sealNativeGuiRuntime(runtime, gui, { platform: 'macos', version: payloadVersion })"]
]) {
  replaceExact(file,
    "import { sealNativeGuiRuntime } from '../src/sealed-native-gui.js';",
    "import { sealNativeGuiRuntime } from '../src/sealed-native-gui.js';\nimport { sealNativeGuiRuntimeV11 } from '../src/sealed-native-gui-v11.js';");
  replaceExact(file,
    `const sealed = ${oldCall};`,
    `const sealed = payloadVersion >= 11\n  ? sealNativeGuiRuntimeV11(runtime, gui, { platform: '${platform}' })\n  : ${oldCall};`);
}

// Pages consumes the already-published v1.2 runtime assets and keeps release-digest verification.
replaceExact('.github/workflows/pages.yml', '      - scripts/check-site-v11.js', '      - scripts/check-site-v12.js');
replaceExact('.github/workflows/pages.yml', '      - src/sealed-native-gui.js\n      - src/sealed-native-package.js', '      - src/sealed-native-gui.js\n      - src/sealed-native-gui-v11.js\n      - src/sealed-native-package.js');
replaceExact('.github/workflows/pages.yml', '      - .github/workflows/native-sealed-list-runtime.yml', '      - .github/workflows/native-sealed-list-runtime.yml\n      - .github/workflows/native-sealed-menu-runtime.yml\n      - .github/workflows/native-sealed-menu-release-v12.yml');
replaceExact('.github/workflows/pages.yml',
  'workflows: [Patch Studio Runtime Templates, Patch Native Win32 Runtime, Patch Native Linux Runtime, Patch Native macOS Runtime, Patch Native Responsive Runtime, Patch Native Sealed Table Runtime, Patch Native Sealed List Runtime]',
  'workflows: [Patch Studio Runtime Templates, Patch Native Win32 Runtime, Patch Native Linux Runtime, Patch Native macOS Runtime, Patch Native Responsive Runtime, Patch Native Sealed Table Runtime, Patch Native Sealed List Runtime, Patch Native Sealed Menu Runtime, Patch Native Sealed Menu Runtime v1.2 Release]');
replaceAtLeast('.github/workflows/pages.yml', 'native-win32-runtime-v1.1', 'native-win32-runtime-v1.2', 2);
replaceAtLeast('.github/workflows/pages.yml', 'native-linux-runtime-v1.1', 'native-linux-runtime-v1.2', 2);
replaceAtLeast('.github/workflows/pages.yml', 'native-macos-runtime-v1.1', 'native-macos-runtime-v1.2', 2);

// Current site validator becomes v1.2; the Table-era validator still checks additive compatibility.
fs.renameSync('scripts/check-site-v11.js', 'scripts/check-site-v12.js');
replaceAtLeast('scripts/check-site-v12.js', 'v1.1', 'v1.2', 2);
replaceAtLeast('scripts/check-site-v12.js', 'payload v10', 'payload v11', 1);
replaceExact('scripts/check-site-v12.js', 'PATCH_SEALED_NATIVE_GUI_LIST_VERSION', 'PATCH_SEALED_NATIVE_GUI_MENU_VERSION');
replaceExact('scripts/check-site-v12.js', "requireText(docs, 'payload v10/runtime v1.1', 'Documentation current list contract');", "requireText(docs, 'payload v11/runtime v1.2', 'Documentation current Menu contract');");
replaceExact('scripts/check-site-v10.js', 'PATCH_SEALED_NATIVE_GUI_LIST_VERSION', 'PATCH_SEALED_NATIVE_GUI_MENU_VERSION');
replaceExact('scripts/check-site-v10.js', 'payloadVersion: PATCH_SEALED_NATIVE_GUI_LIST_VERSION', 'payloadVersion: PATCH_SEALED_NATIVE_GUI_MENU_VERSION');
replaceExact('package.json', 'node scripts/check-site-v11.js', 'node scripts/check-site-v12.js');

// Current Studio contract test moves from v1.1 to v1.2.
fs.renameSync('tests/studio-ready-v11.test.js', 'tests/studio-ready-v12.test.js');
write('tests/studio-ready-v12.test.js', `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\n\nconst nativeBuild = fs.readFileSync('web/native-build.js', 'utf8');\nconst pages = fs.readFileSync('.github/workflows/pages.yml', 'utf8');\nconst index = fs.readFileSync('web/index.html', 'utf8');\nconst integrity = fs.readFileSync('web/runtime-integrity.js', 'utf8');\n\ntest('Studio token-free Window builds lower Native GUI IR 1.1 and seal payload v11', () => {\n  assert.match(nativeBuild, /buildNativeGuiIRV11 as buildNativeGuiIR/);\n  assert.match(nativeBuild, /sealed-native-gui-v11\\.js/);\n  assert.match(nativeBuild, /PATCH_SEALED_NATIVE_GUI_MENU_VERSION/);\n  assert.match(nativeBuild, /sealNativeGuiRuntimeV11\\(runtimeBytes, nativeGui, \\{ platform: 'windows' \\}\\)/);\n  assert.match(nativeBuild, /payloadVersion: PATCH_SEALED_NATIVE_GUI_MENU_VERSION/);\n  assert.doesNotMatch(nativeBuild, /PATCH_SEALED_NATIVE_GUI_LIST_VERSION/);\n});\n\ntest('Pages gates deployment on published runtime v1.2 assets for all desktop hosts', () => {\n  for (const tag of ['native-win32-runtime-v1.2','native-macos-runtime-v1.2','native-linux-runtime-v1.2']) assert.ok(pages.includes(tag), tag);\n  assert.match(pages, /Patch Native Sealed Menu Runtime v1\\.2 Release/);\n  assert.match(pages, /runtime-integrity-manifest\\.js/);\n  assert.match(pages, /\\^sha256:\\[0-9a-f\\]\\{64\\}\\$/);\n  assert.match(pages, /steps\\.native_runtime\\.outputs\\.ready == 'true'/);\n});\n\ntest('Studio advertises current payload v11 runtime v1.2 Menu and list support', () => {\n  assert.match(index, /token-free Ready\\/offline Windows, macOS and Linux apps/);\n  assert.match(index, /Persistent selection still changes only through explicit <b>change<\\/b>/);\n  assert.match(index, /Native GUI IR 1\\.1/);\n  assert.match(index, /payload v11/);\n  assert.match(index, /runtime v1\\.2/i);\n});\n\ntest('runtime integrity remains a separate browser-side SHA-256 verification gate', () => {\n  assert.match(integrity, /runtime-manifest\\.json/);\n  assert.match(integrity, /SHA-256|sha256/i);\n  assert.match(integrity, /crypto\\.subtle|subtle\\.digest/);\n});\n`);

// Runtime-integrity tests now point at the current releases and current site validator.
replaceAtLeast('tests/studio-runtime-integrity.test.js', 'runtime v1.1', 'runtime v1.2', 1);
replaceAtLeast('tests/studio-runtime-integrity.test.js', 'native-win32-runtime-v1\\.1', 'native-win32-runtime-v1\\.2', 1);
replaceAtLeast('tests/studio-runtime-integrity.test.js', 'native-linux-runtime-v1\\.1', 'native-linux-runtime-v1\\.2', 1);
replaceAtLeast('tests/studio-runtime-integrity.test.js', 'native-macos-runtime-v1\\.1', 'native-macos-runtime-v1\\.2', 1);
replaceExact('tests/studio-runtime-integrity.test.js', '/Patch Native Sealed List Runtime/', '/Patch Native Sealed Menu Runtime v1\\.2 Release/');
replaceExact('tests/studio-runtime-integrity.test.js', '/scripts\\/check-site-v11\\.js/', '/scripts\\/check-site-v12\\.js/');

// Offline linker tests now assert payload v11 and explicitly cover decorated Menu metadata.
replaceExact('tests/offline-linker.test.js',
  "import { decodeNativeGuiPayload } from '../src/sealed-native-gui.js';",
  "import { decodeNativeGuiPayloadV11 } from '../src/sealed-native-gui-v11.js';");
replaceAtLeast('tests/offline-linker.test.js', 'decodeNativeGuiPayload(', 'decodeNativeGuiPayloadV11(', 3);
replaceAtLeast('tests/offline-linker.test.js', 'payload v10', 'payload v11', 3);
replaceAtLeast('tests/offline-linker.test.js', 'footerVersion(executable.bytes), 10', 'footerVersion(executable.bytes), 11', 3);
appendOnce('tests/offline-linker.test.js', "test('macOS Console linking", `const menuWindowSource = \`create boolean advanced = false\ncreate boolean pinned = false\nwindow "Menu state" as main size 620, 340:\n  menu "Actions":\n    item "Enable advanced" as enable_advanced\n    item "Advanced action" as advanced_action enabled advanced shortcut "Primary+E"\n    separator\n    item "Pinned" as pin_item checked pinned shortcut "Primary+P"\nwhen enable_advanced clicked:\n  change advanced:\n    set = true\nwhen pin_item clicked:\n  change pinned:\n    set = true\n\`;\n\ntest('offline Window linker preserves decorated Menu metadata in payload v11', () => {\n  for (const [platform, runtime] of [\n    ['windows', Uint8Array.from([0x4d,0x5a,0,0])],\n    ['linux', Uint8Array.from([0x7f,0x45,0x4c,0x46,0])],\n    ['macos', Uint8Array.from([0xcf,0xfa,0xed,0xfe,0])]\n  ]) {\n    const plan=createOfflineLinkPlan(menuWindowSource,{platform,name:'SealedMenu',guiRuntime:runtime});\n    const executable=executableFrom(plan,platform);\n    const payload=new TextDecoder().decode(decodeNativeGuiPayloadV11(executable.bytes));\n    assert.equal(footerVersion(executable.bytes),11);\n    assert.match(payload,/advanced_action/);\n    assert.match(payload,/Primary|advanced|pinned/);\n  }\n});\n\n`);

// Offline compiler embeds runtime v1.2 and asserts payload v11 across its Window smokes.
replaceAtLeast('.github/workflows/offline-compiler.yml', 'runtime v1.1', 'runtime v1.2', 3);
replaceAtLeast('.github/workflows/offline-compiler.yml', 'payload v10', 'payload v11', 2);
replaceExact('.github/workflows/offline-compiler.yml',
  "'cl.exe /nologo /EHsc /std:c++17 /O2 /MT /utf-8 /DUNICODE /D_UNICODE native-runtime\\win32-sealed-gui-v11.cpp user32.lib gdi32.lib comctl32.lib comdlg32.lib oleacc.lib ole32.lib oleaut32.lib /link /SUBSYSTEM:WINDOWS /OUT:offline-runtime\\gui.bin',",
  "'cl.exe /nologo /EHsc /std:c++17 /O2 /MT /utf-8 /DUNICODE /D_UNICODE /DPATCH_WIN32_RUNTIME_V11_RESTORE_ENTRY=PatchRuntimeV11CompatibilityMain native-runtime\\win32-sealed-gui-v12.cpp user32.lib gdi32.lib comctl32.lib comdlg32.lib oleacc.lib ole32.lib oleaut32.lib /link /SUBSYSTEM:WINDOWS /OUT:offline-runtime\\gui.bin',");
replaceExact('.github/workflows/offline-compiler.yml', 'g++ -std=c++17 -O2 native-runtime/gtk-sealed-gui-v11.cpp -o offline-runtime/gui.bin', 'g++ -std=c++17 -O2 native-runtime/gtk-sealed-gui-v12.cpp -o offline-runtime/gui.bin');
replaceAtLeast('.github/workflows/offline-compiler.yml', 'native-runtime/appkit-sealed-gui-v11.mm', 'native-runtime/appkit-sealed-gui-v12.mm', 2);
replaceAtLeast('.github/workflows/offline-compiler.yml', '-ne 10', '-ne 11', 1);
replaceAtLeast('.github/workflows/offline-compiler.yml', '!==10', '!==11', 3);
replaceAtLeast('.github/workflows/offline-compiler.yml', 'payload v10.', 'payload v11.', 1);
// Keep dependency path triggers for v1.1 and add the v1.2 overlays/menu adapter.
replaceExact('.github/workflows/offline-compiler.yml', '      - native-runtime/sealed-list-v11.hpp\n      - native-runtime/sealed-table-v10.hpp', '      - native-runtime/sealed-list-v11.hpp\n      - native-runtime/sealed-menu-v12.hpp\n      - native-runtime/sealed-table-v10.hpp', 2);
replaceExact('.github/workflows/offline-compiler.yml', '      - native-runtime/win32-sealed-gui-v11.cpp', '      - native-runtime/win32-sealed-gui-v11.cpp\n      - native-runtime/win32-sealed-gui-v12.cpp', 2);
replaceExact('.github/workflows/offline-compiler.yml', '      - native-runtime/appkit-sealed-gui-v11.mm', '      - native-runtime/appkit-sealed-gui-v11.mm\n      - native-runtime/appkit-sealed-gui-v12.mm', 2);
replaceExact('.github/workflows/offline-compiler.yml', '      - native-runtime/gtk-sealed-gui-v11.cpp', '      - native-runtime/gtk-sealed-gui-v11.cpp\n      - native-runtime/gtk-sealed-gui-v12.cpp', 2);
replaceExact('.github/workflows/offline-compiler.yml', '      - examples/listbox-multiselect-native.patch', '      - examples/listbox-multiselect-native.patch\n      - examples/menu-state-window.patch', 2);
replaceExact('.github/workflows/offline-compiler.yml', '          "dist-offline/${{ matrix.asset }}" link examples/listbox-multiselect-native.patch --name OfflineMulti --out dist-smoke/OfflineMulti', '          "dist-offline/${{ matrix.asset }}" link examples/listbox-multiselect-native.patch --name OfflineMulti --out dist-smoke/OfflineMulti\n          "dist-offline/${{ matrix.asset }}" link examples/menu-state-window.patch --name OfflineMenu --out dist-smoke/OfflineMenu');
replaceExact('.github/workflows/offline-compiler.yml', "foreach ($name in @('OfflineResponsive','OfflineTable','OfflineMulti'))", "foreach ($name in @('OfflineResponsive','OfflineTable','OfflineMulti','OfflineMenu'))", 2);
replaceExact('.github/workflows/offline-compiler.yml', 'chmod +x dist-smoke/OfflineLinked dist-smoke/OfflineResponsive dist-smoke/OfflineTable dist-smoke/OfflineMulti', 'chmod +x dist-smoke/OfflineLinked dist-smoke/OfflineResponsive dist-smoke/OfflineTable dist-smoke/OfflineMulti dist-smoke/OfflineMenu');
replaceExact('.github/workflows/offline-compiler.yml', 'xvfb-run -a ./dist-smoke/OfflineMulti --patch-smoke', 'xvfb-run -a ./dist-smoke/OfflineMulti --patch-smoke\n          xvfb-run -a ./dist-smoke/OfflineMenu --patch-smoke');
replaceExact('.github/workflows/offline-compiler.yml', "['OfflineResponsive','OfflineTable','OfflineMulti']", "['OfflineResponsive','OfflineTable','OfflineMulti','OfflineMenu']");
replaceExact('.github/workflows/offline-compiler.yml', '          MULTI_APP=dist-smoke/OfflineMulti.app/Contents/MacOS/OfflineMulti', '          MULTI_APP=dist-smoke/OfflineMulti.app/Contents/MacOS/OfflineMulti\n          MENU_APP=dist-smoke/OfflineMenu.app/Contents/MacOS/OfflineMenu');
replaceExact('.github/workflows/offline-compiler.yml', 'test -x "$CONSOLE_APP" && test -x "$WINDOW_APP" && test -x "$TABLE_APP" && test -x "$MULTI_APP"', 'test -x "$CONSOLE_APP" && test -x "$WINDOW_APP" && test -x "$TABLE_APP" && test -x "$MULTI_APP" && test -x "$MENU_APP"');
replaceExact('.github/workflows/offline-compiler.yml', '"$MULTI_APP" --patch-smoke', '"$MULTI_APP" --patch-smoke\n          "$MENU_APP" --patch-smoke');
replaceExact('.github/workflows/offline-compiler.yml', 'node - "$WINDOW_APP" "$TABLE_APP" "$MULTI_APP"', 'node - "$WINDOW_APP" "$TABLE_APP" "$MULTI_APP" "$MENU_APP"');
replaceExact('.github/workflows/offline-compiler.yml', '"listbox-multiselect-native.patch IntelMulti"', '"listbox-multiselect-native.patch IntelMulti" "menu-state-window.patch IntelMenu"');

// Current Studio copy reflects the now-published current runtime line.
replaceAtLeast('web/index.html', 'payload v10', 'payload v11', 1);
replaceAtLeast('web/index.html', 'Runtime v1.1', 'Runtime v1.2', 1);
replaceAtLeast('web/index.html', 'runtime v1.1', 'runtime v1.2', 1);
replaceAtLeast('web/docs.html', 'payload v10/runtime v1.1', 'payload v11/runtime v1.2', 1);

console.log('Applied current sealed payload v11 / runtime v1.2 consumer migration.');
