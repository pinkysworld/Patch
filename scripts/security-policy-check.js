#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workflowDir = path.join(root, '.github', 'workflows');
const workflowFiles = fs.readdirSync(workflowDir)
  .filter(name => /\.ya?ml$/i.test(name))
  .sort();

const findings = [];
for (const name of workflowFiles) {
  const file = path.join(workflowDir, name);
  const text = fs.readFileSync(file, 'utf8');
  if (/\bpull_request_target\s*:/m.test(text)) findings.push(`${name}: pull_request_target is not allowed without an explicit threat-model exception.`);
  if (/\bpermissions\s*:\s*write-all\b/m.test(text)) findings.push(`${name}: permissions: write-all is forbidden.`);
  if (/(?:curl|wget)[^\n|]*\|\s*(?:sudo\s+)?(?:sh|bash)\b/i.test(text)) findings.push(`${name}: network download piped directly into a shell is forbidden.`);

  for (const match of text.matchAll(/^\s*-?\s*uses:\s*([^\s#]+)\s*$/gm)) {
    const ref = match[1];
    if (ref.startsWith('./') || ref.startsWith('docker://')) continue;
    if (!ref.includes('@')) {
      findings.push(`${name}: remote action '${ref}' has no explicit ref.`);
      continue;
    }
    const version = ref.slice(ref.lastIndexOf('@') + 1).toLowerCase();
    if (['main', 'master', 'head', 'latest', 'develop', 'development'].includes(version)) {
      findings.push(`${name}: remote action '${ref}' uses a branch-like or floating ref.`);
    }
  }
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const dependencyCount = Object.keys(pkg.dependencies ?? {}).length + Object.keys(pkg.devDependencies ?? {}).length + Object.keys(pkg.optionalDependencies ?? {}).length;
if (dependencyCount > 0 && !fs.existsSync(path.join(root, 'package-lock.json'))) {
  findings.push('package.json declares external npm dependencies but package-lock.json is missing.');
}

const dependabot = path.join(root, '.github', 'dependabot.yml');
if (!fs.existsSync(dependabot)) findings.push('.github/dependabot.yml is missing.');
else {
  const text = fs.readFileSync(dependabot, 'utf8');
  for (const marker of ['package-ecosystem: github-actions', 'directory: /', 'interval: weekly']) {
    if (!text.includes(marker)) findings.push(`dependabot.yml is missing '${marker}'.`);
  }
}

const codeql = path.join(workflowDir, 'codeql.yml');
if (!fs.existsSync(codeql)) findings.push('.github/workflows/codeql.yml is missing.');
else {
  const text = fs.readFileSync(codeql, 'utf8');
  for (const marker of ['security-events: write', 'github/codeql-action/init@v4', 'github/codeql-action/analyze@v4', 'javascript-typescript', 'security-extended']) {
    if (!text.includes(marker)) findings.push(`codeql.yml is missing '${marker}'.`);
  }
}

if (findings.length) {
  console.error('Patch security policy check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(`Patch security policy check passed across ${workflowFiles.length} workflow file(s); external npm dependencies: ${dependencyCount}.`);
