// Shared by the hosted desk and Control Tower. Presentation only; no side effects.
type Row = { facts_revision?: number; source?: {prior_response?: unknown}; reply_drafts?: {id?: string; version?: number; current?: boolean; facts_revision?: number; body?: string}[]; reply_reviews?: {draft_id?: string; decision?: string; created_at?: string}[] };
export function deskPresentation(value: unknown, calendarStatus: string) {
 const i = value as Row;
 const draft = [...(i.reply_drafts || [])].sort((a,b)=>(b.version || 0)-(a.version || 0))[0];
 const current = !!draft && draft.current === true && draft.facts_revision === i.facts_revision;
 const review = [...(i.reply_reviews || [])].filter(r=>r.draft_id === draft?.id).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)))[0];
 const sent = !!i.source?.prior_response;
 const reply = sent ? 'Sent by human — do not resend' : !draft ? 'No held reply yet' : !current ? 'Outdated draft — replace before review' : review?.decision === 'needs_changes' ? 'Changes requested — reply remains held' : review?.decision === 'reviewed' ? 'Reviewed — reply remains held' : 'Held — awaiting Ron review';
 const next = sent ? 'Ron: check the existing conversation before any follow-up.' : !current ? 'Ron: prepare a current held reply for review.' : review?.decision === 'needs_changes' ? 'Ron: revise the held reply and review it again.' : calendarStatus !== 'booked' && calendarStatus !== 'not booked' ? 'Ron: confirm event details and refresh the Ryan TheOne calendar assessment; keep the reply held.' : calendarStatus === 'booked' ? 'Ron: review the calendar conflict and possible alternatives; keep the reply held.' : review?.decision === 'reviewed' ? 'Ron: review the next booking step. Sending and reserving the date require separate decisions.' : 'Ron: read the held reply and mark reviewed or request changes.';
 return {draft, current, sent, reply, next, canReview: current && !sent, owner: 'Ron — manual inquiry owner', notification: 'Ryan / Ron delivery status unavailable — no receipt exposed by this desk'};
}

// Only explicit, known fixture labels paired with a non-customer declaration.
export function isProofInquiry(value:unknown){const i=value as {facts?:{title?:string;notes?:string}};return /^(TZ DEFAULT PROOF|T03 MANUAL OWNERSHIP PROOF|RELEASE INTAKE PROOF)(?:\b| )/i.test(i.facts?.title||'')&&/Not a customer\b/i.test(i.facts?.notes||'');}
