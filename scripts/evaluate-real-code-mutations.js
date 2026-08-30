#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const corpusPath = path.join(root, 'studies', 'real-code-mutations', 'corpus.json');
const resultPath = path.join(root, 'studies', 'real-code-mutations', 'results.json');
const checkOnly = process.argv.includes('--check');

const allowedOperations = new Set(['increase', 'decrease', 'set', 'add', 'remove', 'clear']);
const allowedFits = new Set(['direct', 'adapter', 'restructure']);
const allowedContexts = new Set([
  'standalone',
  'coupled_multi_target',
  'external_persisted_state',
  'sequential_same_target',
  'dynamic_target',
  'batched_dynamic_targets',
]);

function fail(message) {
  console.error(`real-code mutation study: ${message}`);
  process.exit(1);
}

function countBy(items, key) {
  const counts = {};
  for (const item of items) {
    const value = item[key];
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
if (corpus.schema_version !== 1) fail('unsupported corpus schema');
if (corpus.study_id !== 'patch-real-code-mutation-audit-v1') fail('unexpected study id');
if (!Array.isArray(corpus.projects) || corpus.projects.length !== 6) fail('study requires exactly six pinned projects');
if (!Array.isArray(corpus.observations) || corpus.observations.length !== 18) fail('study requires exactly eighteen observations');

const projectById = new Map();
for (const project of corpus.projects) {
  if (!project.id || projectById.has(project.id)) fail(`duplicate or missing project id: ${project.id}`);
  if (!/^[0-9a-f]{40}$/.test(project.commit)) fail(`project ${project.id} does not use a full immutable commit SHA`);
  if (!project.repository?.includes('/')) fail(`project ${project.id} has an invalid repository name`);
  projectById.set(project.id, project);
}

const observationIds = new Set();
const perProject = new Map([...projectById.keys()].map(id => [id, 0]));
for (const observation of corpus.observations) {
  if (!observation.id || observationIds.has(observation.id)) fail(`duplicate or missing observation id: ${observation.id}`);
  observationIds.add(observation.id);
  if (!projectById.has(observation.project)) fail(`${observation.id} references unknown project ${observation.project}`);
  if (!observation.path || !observation.anchor || !observation.context) fail(`${observation.id} lacks an auditable source location`);
  if (!allowedOperations.has(observation.operation_family)) fail(`${observation.id} has unknown operation family`);
  if (!allowedFits.has(observation.local_surface_fit)) fail(`${observation.id} has unknown surface-fit class`);
  if (!allowedContexts.has(observation.context_constraint)) fail(`${observation.id} has unknown context-constraint class`);
  if (typeof observation.lean_fragment_shape_match !== 'boolean') fail(`${observation.id} lacks Lean-fragment shape coding`);
  if (observation.lean_fragment_shape_match) {
    if (!['increase', 'decrease'].includes(observation.operation_family)) fail(`${observation.id} claims Lean shape match without a directional numeric operation`);
    if (observation.local_surface_fit !== 'direct') fail(`${observation.id} claims Lean shape match without direct local surface fit`);
  }
  perProject.set(observation.project, perProject.get(observation.project) + 1);
}
for (const [project, count] of perProject) {
  if (count !== 3) fail(`project ${project} has ${count} observations; protocol requires three`);
}

const fitCounts = countBy(corpus.observations, 'local_surface_fit');
const operationCounts = countBy(corpus.observations, 'operation_family');
const contextCounts = countBy(corpus.observations, 'context_constraint');
const leanMatches = corpus.observations.filter(item => item.lean_fragment_shape_match).length;
const standalone = corpus.observations.filter(item => item.context_constraint === 'standalone').length;

const projectSummaries = corpus.projects.map(project => {
  const observations = corpus.observations.filter(item => item.project === project.id);
  return {
    project: project.id,
    repository: project.repository,
    commit: project.commit,
    observations: observations.length,
    local_surface_fit: countBy(observations, 'local_surface_fit'),
    operation_family: countBy(observations, 'operation_family'),
    lean_fragment_shape_matches: observations.filter(item => item.lean_fragment_shape_match).length,
  };
});

const results = {
  schema_version: 1,
  study_id: corpus.study_id,
  sampling_design: corpus.sampling.design,
  inference_boundary: corpus.sampling.inference_boundary,
  project_count: corpus.projects.length,
  observation_count: corpus.observations.length,
  observations_per_project: Object.fromEntries([...perProject.entries()].sort(([a], [b]) => a.localeCompare(b))),
  operation_family_counts: operationCounts,
  local_surface_fit_counts: fitCounts,
  lean_fragment_shape_matches: leanMatches,
  context_constraint_counts: contextCounts,
  standalone_context_observations: standalone,
  non_standalone_context_observations: corpus.observations.length - standalone,
  project_summaries: projectSummaries,
  interpretation_guardrails: [
    'Operation-family coding is not a claim of direct source portability.',
    'Lean-fragment shape matching does not verify or certify the external source program.',
    'Because selection is purposive, ratios and counts are descriptive of this audit only and must not be reported as ecosystem prevalence.',
    'Adapter and restructure classifications intentionally preserve Map, Set, host-persistence, dynamic-target, filter, spread, and multi-target limitations rather than normalizing them away.'
  ]
};

const rendered = stableJson(results);
if (checkOnly) {
  if (!fs.existsSync(resultPath)) fail('results.json is missing; run npm run evaluate:real-code first');
  const current = fs.readFileSync(resultPath, 'utf8');
  if (current !== rendered) fail('results.json is stale relative to corpus.json');
  console.log(`real-code mutation study verified: ${results.project_count} projects, ${results.observation_count} observations`);
} else {
  fs.writeFileSync(resultPath, rendered);
  console.log(rendered.trim());
}
