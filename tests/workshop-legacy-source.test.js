import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const playground = fs.readFileSync('web/playground.js', 'utf8');
const beta35 = fs.readFileSync('web/beta35-studio.js', 'utf8');
const projectRestore = fs.readFileSync('web/project-config-restore.js', 'utf8');
const workshopProject = fs.readFileSync('web/workshop-desk-project.js', 'utf8');
const html = fs.readFileSync('web/index.html', 'utf8');

test('Workshop Desk has one canonical Project-v4 Studio sample owner', () => {
  assert.doesNotMatch(playground, /window "Harbor Desk"/);
  assert.doesNotMatch(playground, /workshopDesk:\s*`/);
  assert.match(playground, /if \(sample\.value === 'workshopDesk'\) return;/);

  assert.doesNotMatch(beta35, /const WORKSHOP_DESK_SAMPLE = `/);
  assert.doesNotMatch(beta35, /loadWindowSample\(WORKSHOP_DESK_SAMPLE\)/);
  assert.doesNotMatch(beta35, /sample\.value === 'workshopDesk'/);

  assert.match(projectRestore, /import \{ WORKSHOP_DESK_PROJECT \} from '\.\/workshop-desk-project\.js'/);
  assert.match(projectRestore, /sample\.value !== 'studioShowcase' && sample\.value !== 'workshopDesk'/);
  assert.match(projectRestore, /if \(sample\.value === 'workshopDesk'\) loadWorkshopDeskProject\(\)/);
  assert.match(projectRestore, /loadStudioProject\(WORKSHOP_DESK_PROJECT/);
  assert.match(workshopProject, /"format": "patch-studio-project"/);
  assert.match(workshopProject, /"version": 4/);
});

test('Project-v4 sample ownership loads before legacy beta35 additions', () => {
  const projectIndex = html.indexOf('./project-config-restore.js');
  const playgroundIndex = html.indexOf('./playground.js');
  const beta35Index = html.indexOf('./beta35-studio.js');
  assert.ok(projectIndex >= 0, 'project-config-restore.js must remain loaded');
  assert.ok(playgroundIndex > projectIndex, 'Project-v4 loader must initialize before playground sample delegation');
  assert.ok(beta35Index > playgroundIndex, 'beta35 additions must initialize after playground.js');
});
