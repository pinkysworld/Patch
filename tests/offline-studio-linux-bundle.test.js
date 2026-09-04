import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import builderModule from '../scripts/offline-studio-compiler-builder.cjs';

const { packageLinuxDesktopArtifact, createDeterministicTarGzip } = builderModule;

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'patch-offline-linux-bundle-'));
}

function write(root, relative, bytes, mode = 0o644) {
  const file = path.join(root, ...relative.split('/'));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes, { mode });
  return file;
}

function tarEntries(gzipBytes) {
  const tar = zlib.gunzipSync(gzipBytes);
  const entries = new Map();
  let offset = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) break;
    const name = nulText(header.subarray(0, 100));
    const mode = parseOctal(header.subarray(100, 108));
    const size = parseOctal(header.subarray(124, 136));
    const type = String.fromCharCode(header[156] || 0);
    const dataStart = offset + 512;
    const dataEnd = dataStart + size;
    assert.ok(dataEnd <= tar.length, `tar entry '${name}' exceeds archive bytes`);
    entries.set(name, { mode, size, type, bytes: Buffer.from(tar.subarray(dataStart, dataEnd)) });
    offset = dataStart + Math.ceil(size / 512) * 512;
  }
  return entries;
}

function nulText(bytes) {
  const nul = bytes.indexOf(0);
  return Buffer.from(nul >= 0 ? bytes.subarray(0, nul) : bytes).toString('utf8');
}

function parseOctal(bytes) {
  const text = nulText(bytes).trim();
  return text ? Number.parseInt(text, 8) : 0;
}

test('Linux Offline Studio keeps direct executable artifacts when no desktop sidecars exist', () => {
  const root = tempRoot();
  try {
    const executable = write(root, 'PlainApp', Buffer.from('plain-native-app'), 0o755);
    assert.equal(packageLinuxDesktopArtifact(executable, 'PlainApp', root), null);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Linux Offline Studio packages executable, hicolor icon and desktop entry into one deterministic tar.gz', () => {
  const root = tempRoot();
  try {
    const executable = write(root, 'Patch_App', Buffer.from('native-app-bytes'), 0o755);
    const iconPath = 'share/icons/hicolor/256x256/apps/Patch_App.png';
    const desktopPath = 'share/applications/Patch_App.desktop';
    const icon = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
    const desktop = Buffer.from('[Desktop Entry]\nType=Application\nName=Patch.App\nExec=Patch_App\nIcon=Patch_App\nTerminal=false\n');
    write(root, iconPath, icon);
    write(root, desktopPath, desktop);

    const first = packageLinuxDesktopArtifact(executable, 'Patch.App', root);
    const firstBytes = fs.readFileSync(first.path);
    const firstSha = crypto.createHash('sha256').update(firstBytes).digest('hex');
    const second = packageLinuxDesktopArtifact(executable, 'Patch.App', root);
    const secondBytes = fs.readFileSync(second.path);
    const secondSha = crypto.createHash('sha256').update(secondBytes).digest('hex');

    assert.equal(first.path, path.join(root, 'Patch_App-linux.tar.gz'));
    assert.equal(first.type, 'application/gzip');
    assert.equal(first.outputKind, 'Linux desktop package (.tar.gz)');
    assert.equal(firstSha, secondSha);
    assert.deepEqual([...firstBytes.subarray(4, 8)], [0, 0, 0, 0]);
    assert.equal(firstBytes[9], 255);

    const entries = tarEntries(firstBytes);
    assert.deepEqual([...entries.keys()], [
      'Patch_App',
      iconPath,
      desktopPath
    ]);
    assert.equal(entries.get('Patch_App').mode, 0o755);
    assert.equal(entries.get(iconPath).mode, 0o644);
    assert.equal(entries.get(desktopPath).mode, 0o644);
    assert.equal(entries.get('Patch_App').bytes.toString(), 'native-app-bytes');
    assert.deepEqual(entries.get(iconPath).bytes, icon);
    assert.deepEqual(entries.get(desktopPath).bytes, desktop);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Linux Offline Studio fails closed on incomplete desktop sidecars', () => {
  const root = tempRoot();
  try {
    const executable = write(root, 'BrokenApp', Buffer.from('native-app-bytes'), 0o755);
    write(root, 'share/applications/BrokenApp.desktop', Buffer.from('[Desktop Entry]\nExec=BrokenApp\n'));
    assert.throws(
      () => packageLinuxDesktopArtifact(executable, 'BrokenApp', root),
      /incomplete Linux desktop package/i
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('deterministic Linux tar writer rejects path escape entries', () => {
  const root = tempRoot();
  try {
    const file = write(root, 'payload', Buffer.from('x'));
    assert.throws(
      () => createDeterministicTarGzip([{ name: '../escape', file, mode: 0o644 }]),
      /safe relative tar path/i
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
