import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { compileToDirectWasm } from './wasm-direct.js';

export const PATCH_NATIVE_APP_VERSION = '0.1';
export const PATCH_NATIVE_RUNTIME = 'wasmtime-47.0.3';

export class NativeAppBuildError extends Error {}

export function createNativeBuildPlan(source, options = {}) {
  const platform = options.platform ?? process.platform;
  if (!['darwin', 'win32', 'linux'].includes(platform)) {
    throw new NativeAppBuildError(`Native app builds currently support macOS, Windows and Linux; '${platform}' is not yet supported.`);
  }

  const name = safeAppName(options.name ?? 'PatchApp');
  const desktopShell = options.desktopShell ?? false;
  const compiled = compileToDirectWasm(source, {
    name,
    kind: 'console',
    entry: options.entry ?? 'main.patch'
  });

  return {
    format: 'patch-native-build-plan',
    version: PATCH_NATIVE_APP_VERSION,
    runtime: PATCH_NATIVE_RUNTIME,
    platform,
    name,
    desktopShell,
    module: compiled.module,
    directMetadata: compiled.metadata,
    compiled: compiled.compiled,
    cargoToml: cargoToml(name),
    mainRs: nativeHostSource(name, desktopShell)
  };
}

export function buildNativeApp(source, options = {}) {
  const plan = createNativeBuildPlan(source, options);
  if (options.platform && options.platform !== process.platform) {
    throw new NativeAppBuildError(
      `Cross-OS native compilation is not performed locally. Build '${options.platform}' on that OS or use the Patch Native Apps GitHub Actions workflow.`
    );
  }

  ensureCargo();
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-native-'));
  try {
    const srcDir = path.join(temp, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(temp, 'Cargo.toml'), plan.cargoToml, 'utf8');
    fs.writeFileSync(path.join(srcDir, 'main.rs'), plan.mainRs, 'utf8');
    fs.writeFileSync(path.join(srcDir, 'app.wasm'), plan.module);

    const built = spawnSync('cargo', ['build', '--release', '--manifest-path', path.join(temp, 'Cargo.toml')], {
      cwd: temp,
      stdio: options.quiet ? 'pipe' : 'inherit',
      encoding: 'utf8'
    });
    if (built.error) throw new NativeAppBuildError(`Could not start Cargo: ${built.error.message}`);
    if (built.status !== 0) {
      const detail = options.quiet ? `\n${built.stderr || built.stdout || ''}` : '';
      throw new NativeAppBuildError(`Native host compilation failed.${detail}`);
    }

    const cargoBinary = path.join(temp, 'target', 'release', process.platform === 'win32' ? 'patch_native_app.exe' : 'patch_native_app');
    if (!fs.existsSync(cargoBinary)) throw new NativeAppBuildError(`Cargo finished but the native host was not found at ${cargoBinary}.`);

    if (plan.platform === 'darwin' && (options.bundle ?? true)) {
      const appPath = normalizeMacAppOutput(options.out, plan.name);
      writeMacAppBundle(cargoBinary, appPath, plan.name);
      return { ...plan, output: appPath, outputKind: 'macOS .app bundle' };
    }

    const output = normalizeBinaryOutput(options.out, plan.name, plan.platform);
    fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
    fs.copyFileSync(cargoBinary, output);
    if (plan.platform !== 'win32') fs.chmodSync(output, 0o755);
    return { ...plan, output, outputKind: plan.platform === 'win32' ? 'Windows .exe' : 'native executable' };
  } finally {
    if (!options.keepBuildDir) fs.rmSync(temp, { recursive: true, force: true });
  }
}

function ensureCargo() {
  const check = spawnSync('cargo', ['--version'], { stdio: 'pipe', encoding: 'utf8' });
  if (check.error || check.status !== 0) {
    throw new NativeAppBuildError('Native app builds need the Rust toolchain (cargo) once on the build machine. Install Rust, then rerun the same Patch build command.');
  }
}

function cargoToml(name) {
  return `[package]\nname = "patch_native_app"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\nwasmtime = "=47.0.3"\n\n[profile.release]\nopt-level = "s"\nstrip = true\n\n[package.metadata.patch]\napp-name = "${tomlEscape(name)}"\n`;
}

function nativeHostSource(name, desktopShell) {
  return `use std::error::Error;\n#[cfg(any(target_os = "macos", target_os = "windows"))]\nuse std::process::Command;\nuse std::sync::{Arc, Mutex};\nuse wasmtime::{Engine, Linker, Module, Store};\n\nstatic APP_WASM: &[u8] = include_bytes!("app.wasm");\n#[cfg(any(target_os = "macos", target_os = "windows"))]\nconst APP_NAME: &str = ${JSON.stringify(name)};\nconst DESKTOP_SHELL: bool = ${desktopShell ? 'true' : 'false'};\n\nfn main() -> Result<(), Box<dyn Error>> {\n    let engine = Engine::default();\n    let module = Module::from_binary(&engine, APP_WASM)?;\n    let output = Arc::new(Mutex::new(Vec::<String>::new()));\n    let mut linker = Linker::new(&engine);\n\n    let shown = Arc::clone(&output);\n    linker.func_wrap("patch", "show_number", move |value: f64| {\n        let line = format_number(value);\n        println!("{}", line);\n        if let Ok(mut lines) = shown.lock() { lines.push(line); }\n    })?;\n    linker.func_wrap("patch", "change_number", |_target: i32, _before: f64, _after: f64| {})?;\n\n    let mut store = Store::new(&engine, ());\n    let instance = linker.instantiate(&mut store, &module)?;\n    let run = instance.get_typed_func::<(), ()>(&mut store, "run")?;\n    run.call(&mut store, ())?;\n\n    if DESKTOP_SHELL && std::env::var_os("PATCH_NATIVE_HEADLESS").is_none() {\n        let text = output.lock().map(|lines| lines.join("\\n")).unwrap_or_default();\n        if !text.is_empty() { present_output(&text); }\n    }\n    Ok(())\n}\n\nfn format_number(value: f64) -> String {\n    if value.is_finite() && value.fract() == 0.0 { format!("{:.0}", value) } else { value.to_string() }\n}\n\n#[cfg(target_os = "macos")]\nfn present_output(text: &str) {\n    let _ = Command::new("/usr/bin/osascript")\n        .args(["-e", "on run argv", "-e", "display dialog (item 1 of argv) with title (item 2 of argv)", "-e", "end run", text, APP_NAME])\n        .status();\n}\n\n#[cfg(target_os = "windows")]\nfn present_output(text: &str) {\n    let _ = Command::new("powershell")\n        .args(["-NoProfile", "-Command", "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show($env:PATCH_OUTPUT, $env:PATCH_TITLE) | Out-Null"])\n        .env("PATCH_OUTPUT", text)\n        .env("PATCH_TITLE", APP_NAME)\n        .status();\n}\n\n#[cfg(not(any(target_os = "macos", target_os = "windows")))]\nfn present_output(_text: &str) {}\n`;
}

function writeMacAppBundle(binary, appPath, name) {
  fs.rmSync(appPath, { recursive: true, force: true });
  const macosDir = path.join(appPath, 'Contents', 'MacOS');
  fs.mkdirSync(macosDir, { recursive: true });
  const executableName = safeExecutableName(name);
  const target = path.join(macosDir, executableName);
  fs.copyFileSync(binary, target);
  fs.chmodSync(target, 0o755);
  fs.writeFileSync(path.join(appPath, 'Contents', 'Info.plist'), macInfoPlist(name, executableName), 'utf8');
}

function macInfoPlist(name, executableName) {
  const bundleId = `org.patchlang.${safeBundlePart(name)}`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>\n<key>CFBundleName</key><string>${xmlEscape(name)}</string>\n<key>CFBundleDisplayName</key><string>${xmlEscape(name)}</string>\n<key>CFBundleExecutable</key><string>${xmlEscape(executableName)}</string>\n<key>CFBundleIdentifier</key><string>${bundleId}</string>\n<key>CFBundlePackageType</key><string>APPL</string>\n<key>CFBundleShortVersionString</key><string>0.1</string>\n<key>CFBundleVersion</key><string>1</string>\n</dict></plist>\n`;
}

function normalizeMacAppOutput(out, name) {
  const candidate = out ?? `${name}.app`;
  return candidate.endsWith('.app') ? candidate : `${candidate}.app`;
}
function normalizeBinaryOutput(out, name, platform) {
  if (out) {
    if (platform === 'win32' && !out.toLowerCase().endsWith('.exe')) return `${out}.exe`;
    return out;
  }
  return platform === 'win32' ? `${name}.exe` : name;
}
function safeAppName(name) { const cleaned = String(name).trim().replace(/[^A-Za-z0-9 _.-]/g, '').replace(/\s+/g, ' ').slice(0, 80); return cleaned || 'PatchApp'; }
function safeExecutableName(name) { return name.replace(/[^A-Za-z0-9_-]/g, '_') || 'PatchApp'; }
function safeBundlePart(name) { return name.toLowerCase().replace(/[^a-z0-9.-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'app'; }
function tomlEscape(text) { return String(text).replace(/\\/g, '\\\\').replace(/"/g, '\\"'); }
function xmlEscape(text) { return String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]); }
