import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRemoteBuildRequest,
  dispatchRemoteBuild,
  waitForRemoteBuild,
  listRemoteBuildArtifacts
} from '../src/remote-build.js';

test('remote build request keeps one request id and preserves UTF-8 Patch source', () => {
  const request = createRemoteBuildRequest({
    source: 'create text greeting = "Grüße"\nshow greeting',
    name: 'Hello Patch',
    kind: 'window',
    target: 'macos',
    requestId: 'patch-test-123'
  });
  assert.equal(request.requestId, 'patch-test-123');
  assert.equal(request.inputs.request_id, 'patch-test-123');
  assert.equal(request.inputs.kind, 'window');
  assert.equal(request.inputs.target, 'macos');
  assert.equal(Buffer.from(request.inputs.source_b64, 'base64').toString('utf8'), 'create text greeting = "Grüße"\nshow greeting');
});

test('remote build dispatch sends Studio source to native-apps workflow', async () => {
  let call;
  const fetchImpl = async (url, options) => {
    call = { url, options };
    return new Response(null, { status: 204 });
  };
  const request = createRemoteBuildRequest({ source: 'create number x = 1', requestId: 'patch-dispatch', target: 'all' });
  await dispatchRemoteBuild({ token: 'token', request, fetchImpl });
  assert.match(call.url, /actions\/workflows\/native-apps\.yml\/dispatches$/);
  const body = JSON.parse(call.options.body);
  assert.equal(body.ref, 'main');
  assert.equal(body.inputs.request_id, 'patch-dispatch');
  assert.equal(body.inputs.source_path, '');
});

test('remote build polling selects the run belonging to the Studio request', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({
    workflow_runs: [
      { id: 1, display_title: 'Studio other · App', status: 'completed', conclusion: 'success' },
      { id: 2, display_title: 'Studio patch-wanted · App · console · linux', status: 'completed', conclusion: 'success', html_url: 'https://github.test/run/2' }
    ]
  }), { status: 200, headers: { 'content-type': 'application/json' } });
  const run = await waitForRemoteBuild({ token: 'token', requestId: 'patch-wanted', fetchImpl, pollMs: 1 });
  assert.equal(run.id, 2);
});

test('remote artifact listing excludes expired artifacts', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({
    artifacts: [
      { id: 10, name: 'windows-console-App', expired: false },
      { id: 11, name: 'old', expired: true }
    ]
  }), { status: 200, headers: { 'content-type': 'application/json' } });
  const artifacts = await listRemoteBuildArtifacts({ token: 'token', runId: 99, fetchImpl });
  assert.deepEqual(artifacts.map(x => x.id), [10]);
});
