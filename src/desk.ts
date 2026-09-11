import { isProofInquiry } from './lib/desk-presentation.ts';
export const DESK = 'https://ifzztblqazgkyqbrybna.supabase.co/functions/v1/booking-intake';
const KEY = 'r1-desk-k';

export type DeskStatus = 'loading' | 'unconfigured' | 'connected' | 'unauthorized' | 'error';

export function classifyDesk(input: { hasToken: boolean; loading: boolean; httpStatus: number | null; ok: boolean }): DeskStatus {
  if (input.loading) return 'loading';
  if (!input.hasToken) return 'unconfigured';
  if (input.httpStatus === 401 || input.httpStatus === 403) return 'unauthorized';
  if (!input.ok) return 'error';
  return 'connected';
}

export function deskBanner(status: DeskStatus): string {
  if (status === 'loading') return 'Opening the live booking desk…';
  if (status === 'connected') return 'Live booking desk connected';
  if (status === 'unauthorized') return 'Operator link not authorized';
  if (status === 'error') return 'Live booking desk error';
  return 'Demo workspace · add your operator link to load the live inbox';
}

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
  if (!k) {
    return { status: 'unconfigured' as const, configured: false as const, inquiries: [] as never[], error: 'Open this Control Tower from your private operator link.', httpStatus: null };
  }
  const response = await fetch(deskUrl(true), { headers: { Accept: 'application/json' } });
  const data = await response.json().catch(() => ({})) as { error?: string; inquiries?: unknown[] };
  const status = classifyDesk({ hasToken: true, loading: false, httpStatus: response.status, ok: response.ok });
  if (status !== 'connected') {
    return { status, configured: false as const, inquiries: [] as never[], error: data.error || (status === 'unauthorized' ? 'Unauthorized.' : 'Could not open the live inbox.'), httpStatus: response.status };
  }
  if (!Array.isArray(data.inquiries)) {
    return { status: 'error' as const, configured: false as const, inquiries: [] as unknown[], error: 'The inbox returned an invalid response. Refresh to retry.', httpStatus: response.status };
  }
  return { status, configured: true as const, inquiries: data.inquiries.filter(i=>!isProofInquiry(i)), error: '', httpStatus: response.status };
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
