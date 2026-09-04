import fs from 'node:fs';
import path from 'node:path';

const CLIENT_SOURCE = path.resolve('scripts/offline-studio-native-build-client.js');
const CLIENT_NAME = 'offline-studio-native-build.js';
const NATIVE_BUILD_MARKER = /<script\s+type="module"\s+src="\.\/native-build\.js(?:\?v=[^"]+)?"><\/script>/;
const CLIENT_TAG = `<script type="module" src="./${CLIENT_NAME}"></script>`;

export function installOfflineStudioSiteOverlay(siteRoot) {
  const root = path.resolve(siteRoot);
  const indexPath = path.join(root, 'index.html');
  if (!fs.existsSync(indexPath)) throw new Error(`Offline Studio site entrypoint is missing: ${indexPath}`);
  if (!fs.existsSync(CLIENT_SOURCE)) throw new Error(`Offline Studio host-build client source is missing: ${CLIENT_SOURCE}`);

  fs.copyFileSync(CLIENT_SOURCE, path.join(root, CLIENT_NAME));

  let html = fs.readFileSync(indexPath, 'utf8');
  if (!html.includes(CLIENT_TAG)) {
    const nativeBuildTag = html.match(NATIVE_BUILD_MARKER)?.[0];
    if (!nativeBuildTag) throw new Error('Offline Studio site does not contain the native-build module marker.');
    html = html.replace(nativeBuildTag, `${CLIENT_TAG}\n${nativeBuildTag}`);
    fs.writeFileSync(indexPath, html, 'utf8');
  }

  return Object.freeze({ client: CLIENT_NAME, entrypoint: indexPath });
}
