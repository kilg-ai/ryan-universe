import test from 'node:test';
import assert from 'node:assert/strict';
import { blankFacts, replyLabel, ryanDateCheck, ryanDateStatus, type Inquiry } from './inquiries.ts';
import { setupValues, todayBriefing, todayInquiryLine, type RecordItem } from './model.ts';
import { classifyDesk, deskBanner } from '../desk.ts';

const now = Date.parse('2026-09-09T21:10:00Z');
const sample: Inquiry = {
  id: 'inq-1',
  revision: 6,
  facts_revision: 1,
  facts: {
    ...blankFacts,
    title: 'Tomeaka Washington booking inquiry',
    contact_name: 'Tomeaka Washington',
    contact_email: 'tomeaka28217@aol.com',
    venue: 'Charlotte/Chevney neighborhood',
    local_date: '2026-10-10',
    local_start: '16:00',
    local_end_date: '2026-10-10',
    local_end: '19:00',
  },
  property_keys: ['RyanThe1'],
  status: 'reply_held',
  source: {
    provider: 'gmail',
    account_id: 'ryank.the1@gmail.com',
    native_id: 'FMfcgzQhWLPzxwZjVRVQzmkbkMgmvMXq',
    observed_at: '2026-09-07T20:09:00Z',
  },
  calendar_checks: [],
  reply_drafts: [{ id: 'd1', version: 2, facts_revision: 1, body: 'held', calendar_check_id: 'c1', created_at: '2026-09-08T20:32:14Z', current: true }],
  reply_reviews: [],
};

const completeCheck = {
  id: 'c1',
  facts_revision: 1,
  current: true,
  fresh: true,
  outcome: 'clear_in_queried_calendars',
  evidence: {
    checked_at: '2026-09-09T21:05:00Z',
    method: 'calendar_api',
    calendars: [{
      account_id: 'ryank.the1@gmail.com',
      calendar_id: 'ryank.the1@gmail.com',
      calendar_timezone: 'America/New_York',
      window_start_utc: '2026-10-10T15:00:00Z',
      window_end_utc: '2026-10-11T01:00:00Z',
      query_complete: true,
      busy_intervals: [] as { start_utc: string; end_utc: string }[],
      evidence_ref: 'cal',
    }],
  },
};

const completeFacts = {
  ...sample.facts,
  event_timezone: 'America/New_York',
  timezone_source: 'Organizer email',
  timezone_confirmed: true,
  start_utc: '2026-10-10T20:00:00Z',
  end_utc: '2026-10-10T23:00:00Z',
};

void test('failed token is unauthorized, not connected', () => {
  assert.equal(classifyDesk({ hasToken: true, loading: false, httpStatus: 401, ok: false }), 'unauthorized');
  assert.equal(deskBanner('unauthorized'), 'Operator link not authorized');
  assert.notEqual(deskBanner('unauthorized'), 'Live booking desk connected');
  assert.equal(classifyDesk({ hasToken: true, loading: true, httpStatus: null, ok: false }), 'loading');
  assert.equal(classifyDesk({ hasToken: true, loading: false, httpStatus: 200, ok: true }), 'connected');
  assert.equal(classifyDesk({ hasToken: true, loading: false, httpStatus: 500, ok: false }), 'error');
  assert.equal(classifyDesk({ hasToken: false, loading: false, httpStatus: null, ok: false }), 'unconfigured');
});

void test('booked/not booked require complete current matching-facts timezone-supported evidence', () => {
  assert.equal(ryanDateCheck(sample, now).status, 'not checked');
  const stale: Inquiry = {
    ...sample,
    calendar_checks: [{ ...completeCheck, fresh: false, evidence: { ...completeCheck.evidence, checked_at: '2026-09-08T22:47:43Z' } }],
  };
  const staleResult = ryanDateCheck(stale, now);
  assert.equal(staleResult.status, 'unknown');
  assert.match(staleResult.reason, /not fresh|stale/i);
  assert.equal(staleResult.lastObservation, '2026-09-08T22:47:43Z');
  assert.match(ryanDateStatus(stale, now), /unknown/);
  assert.match(ryanDateStatus(stale, now), /last observed 2026-09-08T22:47:43Z/);

  const changed: Inquiry = { ...sample, facts_revision: 2, facts: completeFacts, calendar_checks: [completeCheck] };
  assert.equal(ryanDateCheck(changed, now).status, 'unknown');
  assert.match(ryanDateCheck(changed, now).reason, /facts changed/i);

  const incomplete: Inquiry = {
    ...sample,
    facts: completeFacts,
    calendar_checks: [{ ...completeCheck, evidence: { ...completeCheck.evidence, calendars: [{ ...completeCheck.evidence.calendars[0], query_complete: false }] } }],
  };
  assert.equal(ryanDateCheck(incomplete, now).status, 'unknown');
  assert.match(ryanDateCheck(incomplete, now).reason, /incomplete/i);

  const noTimezone: Inquiry = { ...sample, facts: { ...completeFacts, timezone_confirmed: false }, calendar_checks: [completeCheck] };
  assert.equal(ryanDateCheck(noTimezone, now).status, 'unknown');
  assert.match(ryanDateCheck(noTimezone, now).reason, /Timezone not confirmed/);

  const clear: Inquiry = { ...sample, facts: completeFacts, calendar_checks: [completeCheck] };
  assert.equal(ryanDateCheck(clear, now).status, 'not booked');
  assert.equal(ryanDateStatus(clear, now), 'not booked');

  const busy: Inquiry = {
    ...clear,
    calendar_checks: [{ ...completeCheck, evidence: { ...completeCheck.evidence, calendars: [{ ...completeCheck.evidence.calendars[0], busy_intervals: [{ start_utc: '2026-10-10T20:00:00Z', end_utc: '2026-10-10T23:00:00Z' }] }] } }],
  };
  assert.equal(ryanDateCheck(busy, now).status, 'booked');
});

void test('Today and inbox agree prior_response is sent by human', () => {
  assert.equal(replyLabel(sample), 'reply held');
  const sent: Inquiry = {
    ...sample,
    source: {
      ...sample.source,
      prior_response: { native_id: '1a083961257eaa2f', observed_at: '2026-09-09T00:34:01Z', note: 'Reply already sent from Gmail.' },
    },
  };
  assert.equal(replyLabel(sent), 'sent by human');
  const line = todayInquiryLine(sent);
  assert.match(line.detail, /sent by human/);
  assert.doesNotMatch(line.detail, /reply held/);
});

void test('setup values reset per prompt and do not leak previous answers', () => {
  const leaked = setupValues('priority', { outcome: 'run YouTube this week', owner: 'Ryan' });
  assert.equal(leaked.outcome, 'run YouTube this week');
  const next = setupValues('RyanThe1');
  assert.equal(next.outcome, '');
  assert.equal(next.owner, '');
  assert.equal(next.url, 'https://ryanthe1.com');
  assert.ok(!Object.values(next).includes('run YouTube this week'));
  const saved = setupValues('RyanThe1', { url: 'https://ryanthe1.com', outcome: 'booking first', owner: 'Ronald' });
  assert.equal(saved.outcome, 'booking first');
  const org = setupValues('organization');
  assert.equal(org.organization, 'Ryan the 1 LLC');
  assert.notEqual(org.owner, saved.owner);
});

void test('calendar identity, valid coverage and actual overlap are mandatory', () => {
  const withCal = (patch: object): Inquiry => ({ ...sample, facts: completeFacts, calendar_checks: [{ ...completeCheck, evidence: { ...completeCheck.evidence, calendars: [{ ...completeCheck.evidence.calendars[0], ...patch }] } }] });
  assert.equal(ryanDateCheck(withCal({calendar_id:'family@example.test'}), now).status, 'unknown');
  assert.equal(ryanDateCheck(withCal({account_id:'other@example.test'}), now).status, 'unknown');
  assert.equal(ryanDateCheck(withCal({window_start_utc:'invalid'}), now).status, 'unknown');
  assert.equal(ryanDateCheck(withCal({busy_intervals:[{start_utc:'invalid',end_utc:'invalid'}]}), now).status, 'unknown');
  assert.equal(ryanDateCheck(withCal({busy_intervals:[{start_utc:'2026-10-10T15:00:00Z',end_utc:'2026-10-10T16:00:00Z'}]}), now).status, 'not booked');
});

void test('HTTP 200 with malformed inbox data does not claim connected', async () => {
  const saved = Object.getOwnPropertyDescriptors(globalThis);
  Object.defineProperty(globalThis, 'location', {value: {href:'https://example.test/'}, configurable:true});
  Object.defineProperty(globalThis, 'sessionStorage', {value: {getItem:()=> 'synthetic-token'}, configurable:true});
  const oldFetch=globalThis.fetch;
  globalThis.fetch=async()=>new Response('{}',{status:200,headers:{'content-type':'application/json'}});
  try {
    const {loadInbox}=await import('../desk.ts');
    assert.equal((await loadInbox()).status, 'error');
    globalThis.fetch=async()=>new Response('{"inquiries":[]}',{status:200,headers:{'content-type':'application/json'}});
    assert.equal((await loadInbox()).status, 'connected');
  } finally {
    globalThis.fetch=oldFetch;
    for(const name of ['location','sessionStorage']) {
      if(saved[name])Object.defineProperty(globalThis,name,saved[name]);
      else Reflect.deleteProperty(globalThis,name);
    }
  }
});


void test('todayBriefing keeps one Tomeaka line; inquiry evidence wins over copied event', () => {
  const sent: Inquiry = {
    ...sample,
    source: {
      ...sample.source,
      prior_response: { native_id: '1a083961257eaa2f', observed_at: '2026-09-09T00:34:01Z', note: 'Reply already sent from Gmail.' },
    },
  };
  const copied: RecordItem = {
    id: 'evt-copy',
    title: 'Tomeaka Washington booking inquiry',
    kind: 'event',
    properties: ['RyanThe1'],
    status: 'Needs review',
    owner: 'Ronald',
    due: '2026-10-10',
    note: 'stale copied narrative',
    provenance: 'User supplied',
    priority: 'High',
    detail: 'Old detail that must not replace inquiry evidence.',
    sourceId: sent.id,
  };
  const unrelated: RecordItem = {
    ...copied,
    id: 'evt-other',
    title: 'Community block party',
    sourceId: undefined,
    detail: 'Unrelated event stays visible.',
  };
  const lines = todayBriefing([copied, unrelated], [sent]);
  const tomeaka = lines.filter((l) => /Tomeaka/i.test(l.headline));
  assert.equal(tomeaka.length, 1);
  assert.equal(tomeaka[0].id, 'brief-inq-' + sent.id);
  assert.match(tomeaka[0].detail, /sent by human/);
  assert.doesNotMatch(tomeaka[0].detail, /Old detail/);
  assert.ok(lines.some((l) => l.recordId === 'evt-other'));
});
