#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const corpus = JSON.parse(fs.readFileSync(path.join(root, 'studies', 'real-code-mutations', 'corpus.json'), 'utf8'));
const projects = new Map(corpus.projects.map(project => [project.id, project]));
const cache = new Map();

async function fetchPinned(project, sourcePath) {
  const key = `${project.repository}@${project.commit}:${sourcePath}`;
  if (cache.has(key)) return cache.get(key);
  const [owner, repo] = project.repository.split('/');
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${project.commit}/${sourcePath}`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Patch-real-code-mutation-audit/1.0' },
  });
  if (!response.ok) {
    throw new Error(`${key}: HTTP ${response.status}`);
  }
  const text = await response.text();
  cache.set(key, text);
  return text;
}

let checked = 0;
for (const observation of corpus.observations) {
  const project = projects.get(observation.project);
  if (!project) throw new Error(`${observation.id}: unknown project`);
  const source = await fetchPinned(project, observation.path);
  if (!source.includes(observation.anchor)) {
    throw new Error(`${observation.id}: anchor not found at pinned source ${project.repository}@${project.commit}:${observation.path}`);
  }
  checked += 1;
}

console.log(`verified ${checked} real-code source anchors across ${cache.size} pinned files`);
