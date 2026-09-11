import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, type RecordItem, type State } from './model.ts';
import {
  answerImportPayload,
  buildWorkspaceGetUrl,
  createRecordPayload,
  importableLocal,
  importOutcomeNotice,
  importPostParts,
  provenanceFromSql,
  provenanceToSql,
  recordFromEnvelope,
  recordImportPayload,
  stateFromWorkspace,
  statusFromSql,
  statusToSql,
  updatePatchPayload,
  workspaceErrorMessage,
} from './workspace.ts';

const userRecord: RecordItem = {
  id: 'local-user-1',
  title: 'Neighborhood follow-up',
  kind: 'task',
  properties: ['GSB'],
  status: 'Needs review',
  owner: 'Ronald',
  due: '2026-10-10',
  note: 'User supplied only',
  provenance: 'User supplied',
  priority: 'Normal',
  detail: 'Created on this device',
};

void test('SQL status and provenance round-trip to UI labels', () => {
  assert.equal(statusToSql('Needs review'), 'needs_review');
  assert.equal(statusFromSql('in_progress'), 'In progress');
  assert.equal(statusFromSql('planned'), 'Planned');
  assert.equal(statusFromSql('done'), 'Done');
  assert.equal(provenanceToSql('Demo'), 'demo');
  assert.equal(provenanceToSql('User supplied'), 'user_supplied');
  assert.equal(provenanceFromSql('demo'), 'Demo');
  assert.equal(provenanceFromSql('user_supplied'), 'User supplied');
  assert.equal(provenanceFromSql('live_source'), 'User supplied');
  const item = recordFromEnvelope({
    id: '11111111-1111-4111-8111-111111111111',
    kind: 'task',
    title: 'Shared GSB task',
    status: 'in_progress',
    provenance: 'user_supplied',
    detail: 'from desk',
    owner: 'Ryan',
    due: '2026-10-10',
    note: '',
    revision: 2,
    import_native_id: 'local-user-1',
    property_keys: ['GSB'],
  });
  assert.equal(item.status, 'In progress');
  assert.equal(item.provenance, 'User supplied');
  assert.equal(item.revision, 2);
  assert.equal(item.importNativeId, 'local-user-1');
});

void test('GET workspace URL keeps operator token and workspace=1', () => {
  const url = new URL(buildWorkspaceGetUrl('https://example.test/booking-intake', 'operator-token'));
  assert.equal(url.searchParams.get('k'), 'operator-token');
  assert.equal(url.searchParams.get('workspace'), '1');
  assert.equal(url.searchParams.get('format'), 'json');
});

void test('explicit import excludes demo rows and already-imported native ids', () => {
  const local: State = {
    ...initialState(),
    records: [
      ...initialState().records,
      userRecord,
    ],
    answers: { priority: { values: { outcome: 'run Today', owner: 'both' }, savedAt: '2026-09-10T01:00:00Z', status: 'Details saved · Not verified' } },
  };
  const empty = importableLocal(local, { records: [], answers: {}, activity: [] });
  assert.equal(empty.records.length, 1);
  assert.equal(empty.records[0].id, 'local-user-1');
  assert.ok(empty.records.every((r) => r.provenance === 'User supplied'));
  assert.ok(local.records.some((r) => r.provenance === 'Demo'));
  assert.equal(empty.answers.length, 1);
  const shared = stateFromWorkspace({
    records: [{
      id: 'srv-1', kind: 'task', title: 'Neighborhood follow-up', status: 'needs_review', provenance: 'user_supplied',
      detail: 'Created on this device', revision: 1, import_native_id: 'local-user-1', property_keys: ['GSB'],
    }],
    answers: [{ prompt_id: 'priority', values: { outcome: 'run Today', owner: 'both' }, revision: 1 }],
  });
  const pending = importableLocal(local, shared);
  assert.equal(pending.records.length, 0);
  assert.equal(pending.answers.length, 0);
});

void test('import payloads use stable native ids and 64-hex digests', async () => {
  const rec = await recordImportPayload(userRecord);
  assert.equal(rec.import_native_id, 'local-user-1');
  assert.match(rec.import_content_digest, /^[0-9a-f]{64}$/);
  assert.equal(rec.provenance, 'user_supplied');
  const again = await recordImportPayload(userRecord);
  assert.equal(again.import_content_digest, rec.import_content_digest);
  const ans = await answerImportPayload('priority', { values: { owner: 'both', outcome: 'run Today' }, savedAt: 'x', status: 'Details saved · Not verified' });
  const ans2 = await answerImportPayload('priority', { values: { outcome: 'run Today', owner: 'both' }, savedAt: 'y', status: 'Details saved · Not verified' });
  assert.equal(ans.import_native_id, 'priority');
  assert.equal(ans.import_content_digest, ans2.import_content_digest);
});

void test('create/update payloads never send browser identity as actor', () => {
  const created = createRecordPayload({ title: 'New idea', kind: 'idea', properties: ['YouTube'], note: 'note' });
  assert.equal(created.provenance, 'user_supplied');
  assert.equal(created.status, 'needs_review');
  assert.ok(!('created_by' in created));
  assert.ok(!('sites_subject' in created));
  const patch = updatePatchPayload({ status: 'Done', title: 'Done idea' });
  assert.equal(patch.status, 'done');
  assert.equal(patch.title, 'Done idea');
});

void test('conflict and persistence failure keep local data and do not look shared', () => {
  assert.match(workspaceErrorMessage(409), /not overwritten/i);
  assert.match(workspaceErrorMessage(500), /Local data was kept/);
  assert.doesNotMatch(workspaceErrorMessage(500), /shared successfully/i);
  const local = initialState();
  assert.ok(local.records.some((r) => r.provenance === 'Demo'));
});

void test('operator failures cannot silently become local writes', async () => {
  const {workspaceWriteMode}=await import('./workspace.ts');
  assert.equal(workspaceWriteMode(true,false),'blocked');
  assert.equal(workspaceWriteMode(true,true),'shared');
  assert.equal(workspaceWriteMode(false,false),'local');
});
void test('failed post-commit refresh does not report mutation failure', async () => {
  const {refreshAfterCommit}=await import('./workspace.ts');
  let attempts=0;
  assert.equal(await refreshAfterCommit(async()=>{attempts++;throw new Error('offline')}),false);
  assert.equal(attempts,1);
  assert.equal(await refreshAfterCommit(async()=>({records:[]})),true);
});
void test('conflicting local setup remains visible for explicit import review', () => {
  const local=initialState();
  local.answers.priority={values:{outcome:'Local answer'},savedAt:'x',status:'Details saved · Not verified'};
  const shared=stateFromWorkspace({records:[],answers:[{prompt_id:'priority',values:{outcome:'Other answer'},revision:1}]});
  const pack=importableLocal(local,shared);
  assert.equal(pack.answers.length,0);
  assert.equal(pack.conflicts.length,1);
  assert.equal(local.answers.priority.values.outcome,'Local answer');
});

void test('mixed pack imports eligible records without sending conflicting setup', () => {
  const local: State = {
    ...initialState(),
    records: [...initialState().records, userRecord],
    answers: { priority: { values: { outcome: 'Local answer' }, savedAt: 'x', status: 'Details saved · Not verified' } },
  };
  const shared = stateFromWorkspace({
    records: [],
    answers: [{ prompt_id: 'priority', values: { outcome: 'Shared answer' }, revision: 1 }],
  });
  const pack = importableLocal(local, shared);
  assert.equal(pack.records.length, 1);
  assert.equal(pack.records[0].id, 'local-user-1');
  assert.equal(pack.answers.length, 0);
  assert.equal(pack.conflicts.length, 1);
  assert.equal(pack.conflicts[0].id, 'priority');
  const posted = importPostParts(pack);
  assert.equal(posted.records.length, 1);
  assert.equal(posted.answers.length, 0);
  assert.ok(!posted.answers.some((row) => row.id === 'priority'));
  const notice = importOutcomeNotice(pack);
  assert.match(notice, /1 user-supplied record/);
  assert.match(notice, /1 setup conflict/);
  assert.match(notice, /not sent/);
  assert.match(notice, /not overwritten/);
  assert.doesNotMatch(notice, /Imported local work to the shared workspace/);
  assert.equal(local.answers.priority.values.outcome, 'Local answer');
});

test('verified setup status is preserved only when supplied by shared backend',()=>{const state=stateFromWorkspace({records:[],answers:[{prompt_id:'priority',values:{},revision:1,status:'Details saved · Verified'},{prompt_id:'organization',values:{},revision:1,status:'unexpected'}]});assert.equal(state.answers.priority.status,'Details saved · Verified');assert.equal(state.answers.organization.status,'Details saved · Not verified');});
