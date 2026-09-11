import { DESK, operatorKey } from '../desk.ts';
import { digest } from './inquiries.ts';
import {
  properties,
  type Answer,
  type PropertyId,
  type RecordItem,
  type State,
  type Status,
} from './model.ts';

export type WorkspaceRecord = {
  id: string;
  kind: RecordItem['kind'];
  title: string;
  status: string;
  provenance: string;
  detail: string;
  owner?: string | null;
  due?: string | null;
  note?: string | null;
  revision: number;
  source_record_id?: string | null;
  import_native_id?: string | null;
  property_keys?: string[] | null;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
};

export type WorkspaceAnswer = {
  prompt_id: string;
  values: Record<string, string>;
  revision: number;
  status?: string;
  import_native_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type WorkspaceSnapshot = { records: WorkspaceRecord[]; answers: WorkspaceAnswer[] };

const sqlStatus: Record<Status, string> = {
  'Needs review': 'needs_review',
  'In progress': 'in_progress',
  Planned: 'planned',
  Done: 'done',
};
const uiStatus: Record<string, Status> = {
  needs_review: 'Needs review',
  in_progress: 'In progress',
  planned: 'Planned',
  done: 'Done',
};

export function statusToSql(status: Status): string {
  return sqlStatus[status];
}

export function statusFromSql(status: string): Status {
  return uiStatus[status] || 'Needs review';
}

export function provenanceToSql(provenance: RecordItem['provenance']): string {
  return provenance === 'Demo' ? 'demo' : 'user_supplied';
}

export function provenanceFromSql(provenance: string): RecordItem['provenance'] {
  return provenance === 'demo' ? 'Demo' : 'User supplied';
}

export function buildWorkspaceGetUrl(desk = DESK, k = ''): string {
  const url = new URL(desk);
  if (k) url.searchParams.set('k', k);
  url.searchParams.set('format', 'json');
  url.searchParams.set('workspace', '1');
  return url.toString();
}

export function workspaceErrorMessage(httpStatus: number, data: { error?: string } = {}): string {
  if (httpStatus === 409) return data.error || 'This record changed. Refresh before retrying. Local data was not overwritten.';
  if (httpStatus === 401 || httpStatus === 403) return data.error || 'Not authorized for the shared workspace.';
  if (httpStatus === 404) return data.error || 'That record is no longer on the shared workspace.';
  return data.error || 'Could not save to the shared workspace. Local data was kept.';
}

export function recordFromEnvelope(row: WorkspaceRecord): RecordItem {
  const keys = (row.property_keys || []).filter((k): k is PropertyId => properties.some((p) => p.id === k));
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    properties: keys,
    status: statusFromSql(row.status),
    owner: row.owner || '',
    due: row.due || '',
    note: row.note || '',
    sourceId: row.source_record_id || undefined,
    provenance: provenanceFromSql(row.provenance),
    priority: 'Normal',
    detail: row.detail || '',
    revision: row.revision,
    importNativeId: row.import_native_id || undefined,
  };
}

export function answerFromEnvelope(row: WorkspaceAnswer): Answer {
  const values: Record<string, string> = {};
  if (row.values && typeof row.values === 'object') {
    for (const [k, v] of Object.entries(row.values)) values[k] = typeof v === 'string' ? v : String(v ?? '');
  }
  return {
    values,
    savedAt: row.updated_at || row.created_at || new Date().toISOString(),
    status: row.status === 'Details saved · Verified' ? 'Details saved · Verified' : 'Details saved · Not verified',
    revision: row.revision,
  };
}

export function stateFromWorkspace(snapshot: WorkspaceSnapshot, activity: State['activity'] = []): State {
  const answers: State['answers'] = {};
  for (const row of snapshot.answers || []) answers[row.prompt_id] = answerFromEnvelope(row);
  return { records: (snapshot.records || []).map(recordFromEnvelope), answers, activity };
}

export type ImportPack = {
  records: RecordItem[];
  answers: { id: string; answer: Answer }[];
  conflicts: { id: string; answer: Answer }[];
};

export function importableLocal(local: State, shared: State | null): ImportPack {
  const imported = new Set((shared?.records || []).map((r) => r.importNativeId).filter(Boolean) as string[]);
  const sharedPrompts = new Set(Object.keys(shared?.answers || {}));
  const answers: ImportPack['answers'] = [];
  const conflicts: ImportPack['conflicts'] = [];
  for (const [id, answer] of Object.entries(local.answers)) {
    if (!sharedPrompts.has(id)) {
      answers.push({ id, answer });
      continue;
    }
    const sharedValues = shared?.answers[id]?.values || {};
    if (JSON.stringify(sortedValues(answer.values)) !== JSON.stringify(sortedValues(sharedValues))) {
      conflicts.push({ id, answer });
    }
  }
  return {
    records: local.records.filter((r) => r.provenance === 'User supplied' && !imported.has(r.id)),
    answers,
    conflicts,
  };
}

export function importPostParts(pack: ImportPack): { records: RecordItem[]; answers: ImportPack['answers'] } {
  return { records: pack.records, answers: pack.answers };
}

export function importOutcomeNotice(pack: ImportPack, refreshFailed = false): string {
  const n = pack.records.length;
  const a = pack.answers.length;
  const c = pack.conflicts.length;
  const parts: string[] = [];
  if (n || a) {
    const rec = n ? `${n} user-supplied record${n === 1 ? '' : 's'}` : '';
    const ans = a ? `${a} new setup answer${a === 1 ? '' : 's'}` : '';
    parts.push(`Imported ${[rec, ans].filter(Boolean).join(' and ')}.`);
  }
  if (c) {
    parts.push(`${c} setup conflict${c === 1 ? '' : 's'} stayed on this device and ${c === 1 ? 'was' : 'were'} not sent. Shared answers were not overwritten.`);
  }
  parts.push('This device copy was kept.');
  if (refreshFailed) parts.push('Reload to see imported work before trying again.');
  return parts.join(' ');
}

function sortedValues(values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).sort(([a], [b]) => a.localeCompare(b)));
}

export async function recordImportPayload(record: RecordItem): Promise<{ kind: string; title: string; status: string; provenance: string; detail: string; owner: string; due: string; note: string; property_keys: string[]; import_native_id: string; import_content_digest: string }> {
  const body = {
    kind: record.kind,
    title: record.title,
    status: statusToSql(record.status),
    provenance: 'user_supplied',
    detail: record.detail,
    owner: record.owner,
    due: record.due || '',
    note: record.note,
    property_keys: [...record.properties].sort(),
  };
  return { ...body, import_native_id: record.id, import_content_digest: await digest(JSON.stringify(body)) };
}

export async function answerImportPayload(id: string, answer: Answer): Promise<{ prompt_id: string; values: Record<string, string>; import_native_id: string; import_content_digest: string }> {
  const values = sortedValues(answer.values);
  return {
    prompt_id: id,
    values,
    import_native_id: id,
    import_content_digest: await digest(JSON.stringify({ prompt_id: id, values })),
  };
}

export function createRecordPayload(record: { title: string; kind: RecordItem['kind']; properties: PropertyId[]; note: string }) {
  return {
    kind: record.kind,
    title: record.title,
    status: 'needs_review',
    provenance: 'user_supplied',
    detail: record.note || 'Created in the Control Tower.',
    owner: '',
    due: '',
    note: record.note || '',
    property_keys: record.properties,
  };
}

export function updatePatchPayload(patch: Partial<Pick<RecordItem, 'title' | 'status' | 'owner' | 'due' | 'note' | 'properties'>>) {
  const body: Record<string, unknown> = {};
  if (patch.title !== undefined) body.title = patch.title;
  if (patch.status !== undefined) body.status = statusToSql(patch.status);
  if (patch.owner !== undefined) body.owner = patch.owner;
  if (patch.due !== undefined) body.due = patch.due;
  if (patch.note !== undefined) body.note = patch.note;
  if (patch.properties !== undefined) body.property_keys = patch.properties;
  return body;
}

async function workspacePost(body: Record<string, unknown>) {
  const k = operatorKey();
  if (!k) throw new Error('Open this Control Tower from your private operator link.');
  const url = new URL(DESK);
  url.searchParams.set('k', k);
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(workspaceErrorMessage(response.status, data));
  return data;
}

export async function loadWorkspace(): Promise<WorkspaceSnapshot> {
  const k = operatorKey();
  if (!k) throw new Error('Open this Control Tower from your private operator link.');
  const response = await fetch(buildWorkspaceGetUrl(DESK, k), { headers: { Accept: 'application/json' } });
  const data = await response.json().catch(() => ({})) as { error?: string; records?: unknown; answers?: unknown };
  if (!response.ok) throw new Error(workspaceErrorMessage(response.status, data));
  if (!Array.isArray(data.records) || !Array.isArray(data.answers)) {
    throw new Error('Shared workspace is not available on this desk yet. Local data was kept.');
  }
  return { records: data.records as WorkspaceRecord[], answers: data.answers as WorkspaceAnswer[] };
}

export async function workspaceCreate(record: ReturnType<typeof createRecordPayload>) {
  return workspacePost({ action: 'workspace_create', record });
}

export async function workspaceUpdate(record_id: string, expected_revision: number, patch: Record<string, unknown>) {
  return workspacePost({ action: 'workspace_update', record_id, expected_revision, patch });
}

export async function workspaceSaveSetup(prompt_id: string, expected_revision: number, values: Record<string, string>) {
  return workspacePost({ action: 'workspace_save_setup', prompt_id, expected_revision, values });
}

export async function workspaceImport(records: unknown[], answers: unknown[]) {
  return workspacePost({ action: 'workspace_import', records, answers });
}

export function labeledLocalNotice(): string {
  return 'Saved on this device. Not shared.';
}

export function workspaceWriteMode(hasToken: boolean, ready: boolean): 'local' | 'shared' | 'blocked' {
  return hasToken ? (ready ? 'shared' : 'blocked') : 'local';
}

// A read failure after a committed mutation must never be presented as a failed write.
export async function refreshAfterCommit(refresh: () => Promise<unknown>): Promise<boolean> {
  try { await refresh(); return true; } catch { return false; }
}
