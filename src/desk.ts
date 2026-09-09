export const DESK = 'https://ifzztblqazgkyqbrybna.supabase.co/functions/v1/booking-intake';
const KEY = 'r1-desk-k';

export function operatorKey(): string {
  const url = new URL(location.href);
  const fromQuery = url.searchParams.get('k') || '';
  if (fromQuery) {
    sessionStorage.setItem(KEY, fromQuery);
    url.searchParams.delete('k');
    history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    return fromQuery;
  }
  return sessionStorage.getItem(KEY) || '';
}

export function deskUrl(formatJson = false): string {
  const k = operatorKey();
  const url = new URL(DESK);
  if (k) url.searchParams.set('k', k);
  if (formatJson) url.searchParams.set('format', 'json');
  return url.toString();
}

export async function loadInbox() {
  const k = operatorKey();
  if (!k) return { configured: false as const, inquiries: [] as never[], error: 'Open this Control Tower from your private operator link.' };
  const response = await fetch(deskUrl(true), { headers: { Accept: 'application/json' } });
  const data = await response.json().catch(() => ({})) as { error?: string; inquiries?: unknown[] };
  if (!response.ok) throw new Error(data.error || 'Could not open the live inbox.');
  return { configured: true as const, inquiries: data.inquiries || [], error: '' };
}

export async function reviewReply(input: { inquiry_id: string; expected_revision: number; draft_id: string; decision: 'reviewed' | 'needs_changes' }) {
  const response = await fetch(deskUrl(false), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'review_reply', ...input }),
  });
  const data = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(data.error || 'Could not save the review.');
  return data;
}
