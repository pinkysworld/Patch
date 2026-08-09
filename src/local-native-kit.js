export const PATCH_LOCAL_NATIVE_KIT_VERSION = '0.1';
export const PATCH_LOCAL_NATIVE_SOURCE_REF = 'main';

const ARCHIVE_BASE = 'https://github.com/pinkysworld/Patch/archive/refs/heads';
const ARCHIVE_DIR = 'Patch-main';

export class LocalNativeKitError extends Error {}

export function buildLocalNativeKit(source, options = {}) {
  const platform = normalizePlatform(options.platform);
  const kind = options.kind === 'window' ? 'window' : 'console';
  const name = safeName(options.name ?? 'PatchApp');
  if (platform === 'freebsd' && kind === 'window') {
    throw new LocalNativeKitError('FreeBSD local kits currently support Console projects only.');
  }

  const files = buildLocalNativeKitFiles(source, { platform, kind, name });
  return {
    format: 'patch-local-native-kit',
    version: PATCH_LOCAL_NATIVE_KIT_VERSION,
    platform,
    kind,
    name,
    filename: `${safeFileName(name)}-${platform}-${kind}-local-build.zip`,
    files,
    bytes: zipStore(files)
  };
}

export function buildLocalNativeKitFiles(source, options = {}) {
  const platform = normalizePlatform(options.platform);
  const kind = options.kind === 'window' ? 'window' : 'console';
  const name = safeName(options.name ?? 'PatchApp');
  if (platform === 'freebsd' && kind === 'window') {
    throw new LocalNativeKitError('FreeBSD local kits currently support Console projects only.');
  }

  const common = [
    { name: 'main.patch', content: String(source), mode: 0o100644 },
    { name: 'README.txt', content: readme(name, platform, kind), mode: 0o100644 }
  ];

  if (platform === 'windows') {
    return [
      ...common,
      { name: 'build.cmd', content: windowsCmd(), mode: 0o100755 },
      { name: 'build.ps1', content: windowsPowerShell(name, kind), mode: 0o100644 }
    ];
  }

  return [
    ...common,
    {
      name: platform === 'macos' ? 'build.command' : 'build.sh',
      content: shellLauncher(name, platform, kind),
      mode: 0o100755
    }
  ];
}

function windowsCmd() {
  return '@echo off\r\nsetlocal\r\npowershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0build.ps1"\r\nset EXITCODE=%ERRORLEVEL%\r\necho.\r\nif not "%EXITCODE%"=="0" echo Patch build failed with exit code %EXITCODE%.\r\nif "%EXITCODE%"=="0" echo Patch build complete. See the dist folder.\r\npause\r\nexit /b %EXITCODE%\r\n';
}

function windowsPowerShell(name, kind) {
  const app = psQuote(name);
  const archive = `${ARCHIVE_BASE}/${PATCH_LOCAL_NATIVE_SOURCE_REF}.zip`;
  const output = `${safeFileName(name)}.exe`;
  const build = kind === 'window'
    ? `& node (Join-Path $repo 'scripts\\build-native-window.js') (Join-Path $here 'main.patch') '${app}' (Join-Path $here 'dist')`
    : `if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) { throw 'Rust/Cargo is required for a native Console executable. Install Rust from https://rustup.rs and run build.cmd again.' }\n  & node (Join-Path $repo 'src\\cli.js') build (Join-Path $here 'main.patch') --kind console --target native --name '${app}' --out (Join-Path $here 'dist\\${psQuote(output)}')`;

  return `$ErrorActionPreference = 'Stop'\n$here = Split-Path -Parent $MyInvocation.MyCommand.Path\n$work = Join-Path $env:TEMP ('patch-local-build-' + [guid]::NewGuid().ToString('N'))\nNew-Item -ItemType Directory -Force -Path $work | Out-Null\ntry {\n  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 22 or newer is required. Install it from https://nodejs.org and run build.cmd again.' }\n  $major = [int](& node -p "process.versions.node.split('.')[0]")\n  if ($major -lt 22) { throw ('Node.js 22 or newer is required; found Node ' + (& node --version)) }\n  $zip = Join-Path $work 'patch.zip'\n  $src = Join-Path $work 'src'\n  Write-Host 'Downloading the public Patch compiler source…'\n  Invoke-WebRequest -UseBasicParsing -Uri '${archive}' -OutFile $zip\n  Expand-Archive -Path $zip -DestinationPath $src -Force\n  $repo = Join-Path $src '${ARCHIVE_DIR}'\n  if (-not (Test-Path $repo)) { throw 'Could not locate the downloaded Patch source.' }\n  New-Item -ItemType Directory -Force -Path (Join-Path $here 'dist') | Out-Null\n  Write-Host 'Building ${psQuote(name)} locally…'\n  ${build}\n  if ($LASTEXITCODE -ne 0) { throw ('Patch build exited with code ' + $LASTEXITCODE) }\n  Write-Host ''\n  Write-Host ('Done. Output: ' + (Join-Path $here 'dist'))\n} finally {\n  Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue\n}\n`;
}

function shellLauncher(name, platform, kind) {
  const app = shQuote(name);
  const archive = `${ARCHIVE_BASE}/${PATCH_LOCAL_NATIVE_SOURCE_REF}.tar.gz`;
  const output = safeFileName(name);
  const fetchCommand = platform === 'freebsd'
    ? `if command -v fetch >/dev/null 2>&1; then fetch -q -o "$ARCHIVE" "${archive}"; elif command -v curl >/dev/null 2>&1; then curl -fL "${archive}" -o "$ARCHIVE"; else echo "Patch build needs fetch or curl." >&2; exit 2; fi`
    : `if command -v curl >/dev/null 2>&1; then curl -fL "${archive}" -o "$ARCHIVE"; elif command -v wget >/dev/null 2>&1; then wget -q "${archive}" -O "$ARCHIVE"; else echo "Patch build needs curl or wget." >&2; exit 2; fi`;

  let build;
  if (platform === 'freebsd') {
    build = `command -v cc >/dev/null 2>&1 || { echo "A C99 compiler (cc) is required on FreeBSD." >&2; exit 2; }\nnode "$REPO/src/cli.js" build "$HERE/main.patch" --kind console --target c99 --out "$HERE/dist/${output}.c"\ncc -std=c99 -O2 "$HERE/dist/${output}.c" -lm -o "$HERE/dist/${output}"\nchmod +x "$HERE/dist/${output}"`;
  } else if (kind === 'window') {
    build = `node "$REPO/scripts/build-native-window.js" "$HERE/main.patch" ${app} "$HERE/dist"`;
  } else {
    build = `command -v cargo >/dev/null 2>&1 || { echo "Rust/Cargo is required for a native Console executable. Install Rust from https://rustup.rs and run this launcher again." >&2; exit 2; }\nnode "$REPO/src/cli.js" build "$HERE/main.patch" --kind console --target native --name ${app} --out "$HERE/dist/${output}"`;
  }

  return `#!/bin/sh\nset -eu\nHERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)\nWORK=$(mktemp -d "${'${TMPDIR:-/tmp}'}/patch-local-build.XXXXXX")\ntrap 'rm -rf "$WORK"' EXIT INT TERM\ncommand -v node >/dev/null 2>&1 || { echo "Node.js 22 or newer is required. Install it from https://nodejs.org and run this launcher again." >&2; exit 2; }\nMAJOR=$(node -p "process.versions.node.split('.')[0]")\n[ "$MAJOR" -ge 22 ] || { echo "Node.js 22 or newer is required; found $(node --version)." >&2; exit 2; }\nARCHIVE="$WORK/patch.tar.gz"\nmkdir -p "$WORK/src" "$HERE/dist"\necho "Downloading the public Patch compiler source…"\n${fetchCommand}\ntar -xzf "$ARCHIVE" -C "$WORK/src"\nREPO="$WORK/src/${ARCHIVE_DIR}"\n[ -d "$REPO" ] || { echo "Could not locate the downloaded Patch source." >&2; exit 2; }\necho "Building ${shellEcho(name)} locally…"\n${build}\necho\necho "Done. Output: $HERE/dist"\n`;
}

function readme(name, platform, kind) {
  const launcher = platform === 'windows' ? 'build.cmd' : platform === 'macos' ? 'build.command' : 'build.sh';
  const launchHelp = platform === 'windows'
    ? 'Double-click build.cmd.'
    : platform === 'macos'
      ? 'Double-click build.command. If macOS removes the executable bit while extracting, run: sh build.command'
      : 'Run: sh build.sh';
  const extra = platform === 'freebsd'
    ? 'FreeBSD Console uses Patch portable C99 and requires the base-system C compiler (cc).'
    : kind === 'window'
      ? 'Window builds require Node.js 22+; Electron Packager is downloaded by npx during the build.'
      : 'Native Console builds require Node.js 22+ and Rust/Cargo because the current native host uses Wasmtime.';

  return `Patch local native build kit\n============================\n\nApp: ${name}\nTarget: ${platform}\nProject type: ${kind}\nKit version: ${PATCH_LOCAL_NATIVE_KIT_VERSION}\n\nThis kit was generated entirely in Patch Studio. Your Patch source was not uploaded and no GitHub token is needed.\n\nHow to build\n------------\n1. Keep all files from this ZIP together.\n2. ${launchHelp}\n3. The launcher downloads the public Patch compiler source from GitHub and writes the finished package to the dist folder.\n\n${extra}\n\nThe optional GitHub Actions mode in Patch Studio remains available when you prefer a cloud build and do not want to install a local toolchain.\n`;
}

export function zipStore(files) {
  const encoder = new TextEncoder();
  const entries = files.map(file => {
    const nameBytes = encoder.encode(file.name);
    const data = file.content instanceof Uint8Array ? file.content : encoder.encode(String(file.content));
    return { ...file, nameBytes, data, crc: crc32(data), offset: 0 };
  });

  const localChunks = [];
  let offset = 0;
  const { time, date } = dosTimestamp(new Date());
  for (const entry of entries) {
    const header = new Uint8Array(30 + entry.nameBytes.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0x0800, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, time, true);
    view.setUint16(12, date, true);
    view.setUint32(14, entry.crc, true);
    view.setUint32(18, entry.data.length, true);
    view.setUint32(22, entry.data.length, true);
    view.setUint16(26, entry.nameBytes.length, true);
    view.setUint16(28, 0, true);
    header.set(entry.nameBytes, 30);
    entry.offset = offset;
    localChunks.push(header, entry.data);
    offset += header.length + entry.data.length;
  }

  const centralChunks = [];
  let centralSize = 0;
  for (const entry of entries) {
    const header = new Uint8Array(46 + entry.nameBytes.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 0x0314, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, 0x0800, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, time, true);
    view.setUint16(14, date, true);
    view.setUint32(16, entry.crc, true);
    view.setUint32(20, entry.data.length, true);
    view.setUint32(24, entry.data.length, true);
    view.setUint16(28, entry.nameBytes.length, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, ((entry.mode ?? 0o100644) << 16) >>> 0, true);
    view.setUint32(42, entry.offset, true);
    header.set(entry.nameBytes, 46);
    centralChunks.push(header);
    centralSize += header.length;
  }

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);
  return concatBytes([...localChunks, ...centralChunks, end]);
}

function concatBytes(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosTimestamp(date) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  };
}

function normalizePlatform(platform) {
  if (['windows', 'macos', 'linux', 'freebsd'].includes(platform)) return platform;
  throw new LocalNativeKitError(`Unsupported local native target '${platform}'.`);
}
function safeName(name) {
  return String(name).trim().replace(/[^A-Za-z0-9 _.-]/g, '').replace(/\s+/g, ' ').slice(0, 80) || 'PatchApp';
}
function safeFileName(name) {
  return safeName(name).replace(/[^A-Za-z0-9_-]/g, '_') || 'PatchApp';
}
function psQuote(text) {
  return String(text).replace(/'/g, "''");
}
function shQuote(text) {
  return `'${String(text).replace(/'/g, `'\"'\"'`)}'`;
}
function shellEcho(text) {
  return String(text).replace(/[\\"`$]/g, '\\$&');
}
