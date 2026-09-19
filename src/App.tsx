import { HeldWork, type HeldSave } from './HeldWork';
import { inquiryAction } from './lib/inquiry-action.ts';
import { heldFor, makeHeld, heldPayload, heldStatus, readHeld, reviewHeld, type HeldPacket } from './lib/held-work';
import { deskPresentation } from './lib/desk-presentation.ts';
import { FormEvent, useEffect, useState } from 'react';
import {
  ArrowRight, ArrowUpRight, CalendarDays, Check, CheckCircle, ChevronRight, Circle,
  LayoutGrid, Orbit, Play, Plus, Search, ShieldCheck, Sparkles,
} from 'lucide-react';
import { deskBanner, loadInbox, operatorKey, reviewReply, type DeskStatus } from './desk';
import {
  applyCommand, initialState, prompts, properties, setupValues, statuses, todayBriefing,
  type Command, type PropertyId, type RecordItem, type State, type Status,
} from './lib/model';
import { replyLabel, ryanDateStatus, type Inquiry } from './lib/inquiries';
import {
  refreshAfterCommit,
  workspaceWriteMode,
  answerImportPayload,
  createRecordPayload,
  importableLocal,
  importOutcomeNotice,
  importPostParts,
  labeledLocalNotice,
  loadWorkspace,
  recordImportPayload,
  stateFromWorkspace,
  updatePatchPayload,
  workspaceCreate,
  workspaceImport,
  workspaceSaveSetup,
  workspaceUpdate,
} from './lib/workspace';

const WORK = 'r1-universe-workspace';
const names: Record<string, string> = {
  today: 'Today',
  inbox: 'Booking inbox',
  universe: 'Portfolio / Universe',
  YouTube: 'YouTube',
  work: 'All work',
  setup: 'Make it live',
};

function findProperty(id: string) {
  return properties.find((p) => p.id === id);
}

function Tags({ ids }: { ids: PropertyId[] }) {
  return (
    <span className="tags">
      {ids.map((id) => (
        <span className="tag" key={id}>
          <i style={{ background: findProperty(id)?.color }} />
          {findProperty(id)?.name}
        </span>
      ))}
    </span>
  );
}

function loadState(): State {
  try {
    const raw = localStorage.getItem(WORK);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw) as State;
    if (!Array.isArray(parsed.records) || typeof parsed.answers !== 'object') return initialState();
    return parsed;
  } catch {
    return initialState();
  }
}

export default function App() {
  const [localState, setLocalState] = useState<State>(() => loadState());
  const [shared, setShared] = useState<State | null>(null);
  const [workspaceError, setWorkspaceError] = useState('');
  const [saveBusy, setSaveBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [view, setView] = useState('today');
  const [tab, setTab] = useState('All');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [add, setAdd] = useState(false);
  const [promptId, setPromptId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('r1-theme') || 'dark');
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [inboxError, setInboxError] = useState('');
  const [inboxReady, setInboxReady] = useState(false);
  const [deskStatus, setDeskStatus] = useState<DeskStatus>('loading');
  const connected = deskStatus === 'connected';
  const usingShared = connected && shared !== null;
  const state = usingShared ? shared : localState;
  const pending = importableLocal(localState, shared);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches));
    localStorage.setItem('r1-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(WORK, JSON.stringify(localState));
  }, [localState]);

  async function refreshWorkspace() {
    const snap = await loadWorkspace();
    const next = stateFromWorkspace(snap);
    setShared(next);
    setWorkspaceError('');
    return next;
  }

  useEffect(() => {
    const controller = new AbortController();
    setDeskStatus(operatorKey() ? 'loading' : 'unconfigured');
    loadInbox()
      .then(async (d) => {
        if (controller.signal.aborted) return;
        setInquiries((d.inquiries as Inquiry[]) || []);
        setInboxError(d.error || '');
        setDeskStatus(d.status);
        setInboxReady(true);
        if (d.status === 'connected') {
          try {
            await refreshWorkspace();
          } catch (e) {
            if (controller.signal.aborted) return;
            setShared(null);
            setWorkspaceError(e instanceof Error ? e.message : 'Shared workspace is unavailable. Local data was kept.');
          }
        } else {
          setShared(null);
        }
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        setInboxError(e instanceof Error ? e.message : 'Could not open the live inbox.');
        setDeskStatus(operatorKey() ? 'error' : 'unconfigured');
        setInboxReady(true);
        setShared(null);
      });
    return () => controller.abort();
  }, []);

  async function send(command: Command) {
    try {
      const mode = workspaceWriteMode(Boolean(operatorKey()), connected && shared !== null);
      if (mode === 'blocked') throw new Error('Shared workspace is unavailable. Refresh before saving; nothing was saved locally.');
      if (mode === 'local') {
        const next = applyCommand(localState, command);
        setLocalState(next);
        setNotice(command.type === 'saveSetup' ? 'Setup details saved on this device · verification still needed.' : labeledLocalNotice());
        return true;
      }
      const live = shared!;
      applyCommand(live, command);
      setSaveBusy(true);
      if (command.type === 'createRecord') {
        await workspaceCreate(createRecordPayload(command.record));
      } else if (command.type === 'updateRecord') {
        const rec = live.records.find((r) => r.id === command.id);
        if (!rec) throw new Error('Record no longer exists.');
        await workspaceUpdate(rec.id, rec.revision ?? 1, updatePatchPayload(command.patch));
      } else if (command.type === 'saveSetup') {
        await workspaceSaveSetup(command.id, live.answers[command.id]?.revision ?? 0, command.values);
      } else if (command.type === 'createDraft') {
        const source = live.records.find((r) => r.id === command.id);
        if (!source) throw new Error('Source not found.');
        await workspaceCreate(createRecordPayload({
          title: `${command.destination === 'RyanThe1' ? 'Hub feature' : 'Content idea'} · ${source.title}`,
          kind: 'idea',
          properties: [...new Set([...source.properties, command.destination])],
          note: 'Draft only. Review source rights, destination and exact content before any publication.',
        }));
      } else {
        throw new Error('Unsupported action.');
      }
      if (!await refreshAfterCommit(refreshWorkspace)) {
        setShared(null);
        setWorkspaceError('Save completed, but refresh failed. Reload before making another change.');
        setNotice('Saved to the shared workspace. Reload to see the result; do not submit again.');
        return true;
      }
      setNotice(command.type === 'saveSetup' ? 'Setup details saved to the shared workspace · verification still needed.' : 'Saved to the shared workspace.');
      return true;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not save.');
      return false;
    } finally {
      setSaveBusy(false);
    }
  }

  async function saveHeld(i:Inquiry,kind:Parameters<HeldSave>[1],input:Parameters<HeldSave>[2]) {
    let committed=false;
    try {
      if(!usingShared)throw new Error('Reconnect the shared workspace before saving.');
      const fresh=await loadInbox();if(fresh.status!=='connected')throw new Error('Refresh the live inquiry before saving.');
      const current=(fresh.inquiries as Inquiry[]).find(row=>row.id===i.id);if(!current||current.facts_revision!==i.facts_revision)throw new Error('Inquiry details changed. Refresh before saving.');
      const workspace=stateFromWorkspace(await loadWorkspace());
      const version=(heldFor(workspace.records,i.id,kind)[0]?.packet.version||0)+1;
      const packet=makeHeld(current,kind,version,input);
      const previous=heldFor(workspace.records,i.id,kind)[0]?.packet;
      if(previous&&JSON.stringify({...previous,version:1,state:'held'})===JSON.stringify({...packet,version:1,state:'held'})){await refreshWorkspace();setNotice('This exact version is already saved and held.');return true;}
      await workspaceImport([await heldPayload(packet)],[]);committed=true;
      await refreshWorkspace();setNotice('Version saved to shared review work. Nothing sent or reserved.');return true;
    }catch(e){if(committed){setShared(null);setWorkspaceError('Saved, but refresh failed. Reload before another change.');}setNotice(committed?'Saved. Reload before another save; do not submit again.':e instanceof Error?e.message:'Could not save held work.');return committed;}
  }
  async function markHeldReviewed(i:Inquiry,record:RecordItem,packet:HeldPacket) {
    let committed=false;
    try {
      if(!usingShared)throw new Error('Reconnect the shared workspace before reviewing.');
      const fresh=await loadInbox();if(fresh.status!=='connected')throw new Error('Refresh the live inquiry before reviewing.');
      const current=(fresh.inquiries as Inquiry[]).find(row=>row.id===i.id);if(!current)throw new Error('Inquiry unavailable.');
      if(JSON.stringify(readHeld(record))!==JSON.stringify(packet))throw new Error('Review version changed. Refresh.');
      await workspaceUpdate(record.id,record.revision??1,{note:JSON.stringify(reviewHeld(packet,current)),status:'needs_review'});committed=true;
      await refreshWorkspace();setNotice('Internal review recorded. Draft remains held; this is not contract approval.');return true;
    }catch(e){if(committed){setShared(null);setWorkspaceError('Review saved, but refresh failed. Reload.');}setNotice(committed?'Review saved. Reload; do not repeat.':e instanceof Error?e.message:'Could not record review.');return committed;}
  }

  async function importLocalWork() {
    if (!connected || shared === null) return;
    setImportBusy(true);
    try {
      const pack = importableLocal(localState, shared);
      const eligible = importPostParts(pack);
      if (!eligible.records.length && !eligible.answers.length) {
        setNotice(importOutcomeNotice(pack));
        return;
      }
      const records = await Promise.all(eligible.records.map(recordImportPayload));
      const answers = await Promise.all(eligible.answers.map((row) => answerImportPayload(row.id, row.answer)));
      await workspaceImport(records, answers);
      if (!await refreshAfterCommit(refreshWorkspace)) {
        setShared(null);
        setWorkspaceError('Eligible import completed, but refresh failed. Conflicting setup was not sent.');
        setNotice(importOutcomeNotice(pack, true));
        return;
      }
      setNotice(importOutcomeNotice(pack));
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Import failed. Local data was kept and not overwritten.');
    } finally {
      setImportBusy(false);
    }
  }

  const go = (v: string) => {
    setView(v);
    setTab('All');
    setQuery('');
  };
  const current = state.records.find((r) => r.id === selected);
  const done = Object.keys(state.answers).length;
  const active = state.records.filter((r) => r.status !== 'Done');
  const property = properties.find((p) => p.id === view);
  const nextPrompt = prompts.find((p) => !state.answers[p.id]) || prompts[prompts.length - 1];
  const lines = todayBriefing(state.records, inquiries);
  const filtered = state.records.filter((r) => { const packet=readHeld(r); return !packet || heldFor(state.records,packet.inquiry,packet.kind)[0]?.record.id===r.id; }).filter((r) =>
    (!property || r.properties.includes(property.id)) &&
    (view !== 'YouTube' || r.kind === 'video' || r.kind === 'idea') &&
    (tab !== 'Needs review' || r.status === 'Needs review') &&
    (tab !== 'Content' || ['media', 'video', 'idea'].includes(r.kind)) &&
    (tab !== 'Done' || r.status === 'Done') &&
    (tab === 'Done' || r.status !== 'Done') &&
    `${r.title} ${r.owner} ${r.properties.join(' ')}`.toLowerCase().includes(query.toLowerCase()),
  );
  const queue = view === 'today' ? filtered.filter((r) => r.kind !== 'media' && r.status !== 'Planned') : filtered;
  const liveInquiry = inquiries[0];

  return (
    <div className="tower">
      <aside className="universe-sidebar tower-nav">
        <button className="brand" onClick={() => go('today')}>
          <span className="brandmark">R<span>1</span></span>
          <span><b>RYAN THE 1</b><small>UNIVERSE</small></span>
        </button>
        <span className="sidebar-caption">YOUR CONTROL TOWER</span>
        <nav>
          {Object.entries(names).map(([id, name]) => (
            <button key={id} className={`nav-item${view === id ? ' is-active' : ''}`} data-active={view === id} onClick={() => go(id)}>
              {id === 'today' ? <LayoutGrid size={18} /> : id === 'inbox' ? <CalendarDays size={18} /> : id === 'universe' ? <Orbit size={18} /> : id === 'YouTube' ? <Play size={18} /> : id === 'work' ? <CheckCircle size={18} /> : <Sparkles size={18} />}
              <span>{name}</span>
              {id === 'setup' && <span className="nav-count">{prompts.length - done}</span>}
            </button>
          ))}
          <a className="nav-item" href={import.meta.env.BASE_URL + "work-map/"}><Orbit size={18}/><span>Project work map</span></a>
        </nav>
        <div className="sidebar-caption">PROPERTIES <span>06</span></div>
        {properties.filter((p) => p.id !== 'YouTube').map((p) => (
          <button key={p.id} className={`nav-property${view === p.id ? ' is-active' : ''}`} onClick={() => go(p.id)}>
            <i style={{ background: p.color }} /><span>{p.name}</span>
          </button>
        ))}
        <div className="sidebar-note">
          <Orbit size={20} />
          <p>One Universe.<br /><strong>More possibilities.</strong></p>
          <span>GitHub source. Live booking desk. No ChatGPT Site.</span>
        </div>
        <div className="account">
          <span className="avatar">RK</span>
          <div><strong>Ryan the 1 LLC</strong><small>{connected ? 'Operator signed in' : 'Private control tower'}</small></div>
          <ShieldCheck size={16} />
        </div>
      </aside>
      <div className="app-inset">
        <header className="topbar">
          <div>
            <span className="breadcrumb">Universe <ChevronRight size={14} /> <strong>{names[view] || property?.name}</strong></span>
          </div>
          <div className="top-actions">
            <span className="preview-badge"><i /> Control tower</span>
            <button className="icon-button" aria-label="Theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>Aa</button>
          </div>
        </header>
        <main className="main-shell">
          <div className="view-heading">
            <div>
              <div className="eyebrow">{view === 'today' ? 'ONE DATABASE · MANY PROPERTIES' : view === 'inbox' ? 'WEBSITE INQUIRY TO HELD REPLY' : property?.label.toUpperCase() || 'RYAN THE 1 UNIVERSE'}</div>
              <h1>{view === 'today' ? 'Today' : names[view] || property?.name}<span className="title-dot">.</span></h1>
              <p>{view === 'today' ? 'RyanThe1 is the hub, not the owner of every record. Today reads the whole Universe.' : view === 'inbox' ? 'Live inquiries from the dedicated Ryan desk. Nothing is sent from here.' : view === 'setup' ? (usingShared ? 'Setup answers save to the shared desk for authorized operators. This device still keeps a local copy.' : 'Answers stay on this device until you open a private operator link. Demo data is labeled.') : view === 'universe' ? 'Six properties. Shared people, content and possibilities.' : property?.description}</p>
            </div>
            {view !== 'inbox' && <button className="button primary" onClick={() => setAdd(true)}><Plus size={17} />Add to the Universe</button>}
          </div>
          <div className={`state-strip${deskStatus === 'error' || deskStatus === 'unauthorized' || workspaceError ? ' error' : ''}`}>
            <span><i />{deskBanner(deskStatus)}{usingShared ? ' · shared workspace' : connected ? '' : ' · local demo'}</span>
            <span>{connected ? `${inquiries.length} live inquir${inquiries.length === 1 ? 'y' : 'ies'}` : deskStatus === 'loading' ? 'Inbox loading' : 'Inbox not connected'} · {usingShared ? `${state.records.length} shared records · ${done} shared setup answers` : `${done} setup answers on this device`}</span>
          </div>
          {workspaceError && <p className="inbox-alert">{workspaceError} Local data remains on this device. <button className="button" onClick={() => location.reload()}>Reload shared workspace</button></p>}
          {usingShared && (pending.records.length > 0 || pending.answers.length > 0 || pending.conflicts.length > 0) && (
            <section className="panel inbox-summary">
              <div>
                <span className="eyebrow">LOCAL COPY PRESERVED</span>
                <h2>Import this device’s work</h2>
                <p>
                  {pending.records.length} user-supplied record{pending.records.length === 1 ? '' : 's'} and {pending.answers.length} new setup answer{pending.answers.length === 1 ? '' : 's'} can import now.
                  {pending.conflicts.length ? ` ${pending.conflicts.length} setup conflict${pending.conflicts.length === 1 ? '' : 's'} stay on this device and will not be sent or overwrite the shared desk.` : ' Demo rows are not imported.'}
                </p>
              </div>
              {(pending.records.length > 0 || pending.answers.length > 0) ? (
                <button className="button primary" disabled={importBusy} onClick={() => void importLocalWork()}>{importBusy ? 'Importing…' : 'Import eligible work'}</button>
              ) : (
                <p className="muted">Nothing eligible to import until setup conflicts are resolved on this device.</p>
              )}
            </section>
          )}

          {view === 'inbox' ? (
            <Inbox records={state.records} sharedAvailable={usingShared} onSaveHeld={saveHeld} onReviewHeld={markHeldReviewed} inquiries={inquiries} error={inboxError} ready={inboxReady} deskStatus={deskStatus} onNotice={setNotice} onReload={async () => {
              try {
                const d = await loadInbox();
                setInquiries((d.inquiries as Inquiry[]) || []);
                setInboxError(d.error || '');
                setDeskStatus(d.status);
              } catch (e) {
                setInquiries([]);
                setInboxError(e instanceof Error ? e.message : 'Could not refresh.');
                setDeskStatus(operatorKey() ? 'error' : 'unconfigured');
              }
            }} />
          ) : view === 'setup' ? (
            <Setup state={state} done={done} nextPrompt={nextPrompt} theme={theme} setTheme={setTheme} setPromptId={setPromptId} shared={usingShared} />
          ) : view === 'universe' ? (
            <>
              <div className="portfolio-grid">
                {properties.map((p) => (
                  <button className="property-card panel" key={p.id} onClick={() => go(p.id)} style={{ '--property-color': p.color } as React.CSSProperties}>
                    <div className="property-card-top"><span className="property-mark">{p.mark}</span><ArrowUpRight size={22} /></div>
                    <span className="eyebrow">{p.label}</span>
                    <h2>{p.name}</h2>
                    <p>{p.description}</p>
                    <div className="property-card-bottom">
                      <span>{active.filter((r) => r.properties.includes(p.id)).length} open records</span>
                      <span>{state.answers[p.id] ? 'Setup details saved' : 'Setup needed'}<ChevronRight size={14} /></span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              {view === 'today' && (
                <section className="panel today-briefing">
                  <div className="section-title">
                    <div>
                      <span className="eyebrow">ONE UNIVERSE · ONE QUEUE</span>
                      <h2>What needs you now.</h2>
                      <p>Website inquiry through held reply. One event, once. Nothing is sent.</p>
                    </div>
                    <span className="counter">{String(lines.length).padStart(2, '0')}</span>
                  </div>
                  {lines.map((line) => {
                    const first = findProperty(line.properties[0]);
                    return (
                      <button className="briefing-row" key={line.id} onClick={() => { if (line.view === 'inbox') go('inbox'); else { setSelected(line.recordId); go(line.view); } }}>
                        <i style={{ background: first?.color || 'var(--signal)' }} />
                        <span className="record-copy">
                          <strong>{line.headline}</strong>
                          <small>{line.detail}</small>
                          <Tags ids={line.properties} />
                        </span>
                        <span className="inbox-state">{line.provenance === 'Demo' ? 'Example' : 'Yours'}<small>{line.view === 'inbox' ? 'Inbox' : first?.name || line.view}</small></span>
                        <ArrowRight size={16} />
                      </button>
                    );
                  })}
                </section>
              )}
              {view === 'today' && liveInquiry && (
                <section className="panel inbox-summary">
                  <div>
                    <span className="eyebrow">BOOKING INBOX</span>
                    <h2>{inquiries.length} website {inquiries.length === 1 ? 'inquiry' : 'inquiries'}</h2>
                    <p>{liveInquiry.facts.title} · Ryan TheOne {ryanDateStatus(liveInquiry)} · {replyLabel(liveInquiry)}</p>
                  </div>
                  <button className="button" onClick={() => go('inbox')}>Open inbox<ArrowRight size={16} /></button>
                </section>
              )}
              {view === 'YouTube' && (
                <div className="youtube-overview">
                  <div className="panel performance">
                    <div className="section-title">
                      <div>
                        <span className="eyebrow">EXAMPLE PERFORMANCE · FIRST 7 DAYS</span>
                        <h2>A mix worth building on</h2>
                      </div>
                      <span className="growth">Demo</span>
                    </div>
                    <p>Live YouTube Studio is not connected. This chart is labeled example data only.</p>
                    <button className="text-button" onClick={() => setSelected('video-1')}>Open the video record<ArrowRight size={16} /></button>
                  </div>
                  <div className="youtube-side">
                    <div className="panel monetization">
                      <Play size={25} />
                      <h3>Monetization</h3>
                      <strong>Not connected</strong>
                      <p>Actual earnings appear only after verified access.</p>
                    </div>
                  </div>
                </div>
              )}
              <div className={view === 'today' ? 'today-grid' : 'work-grid'}>
                <section className="panel work-panel">
                  <div className="section-title">
                    <div>
                      <span className="eyebrow">{view === 'today' ? 'YOUR NEXT MOVES' : 'SHARED WORK'}</span>
                      <h2>{view === 'today' ? 'Attention, in the right places.' : 'Work in motion'}</h2>
                    </div>
                    <span className="counter">{queue.length}</span>
                  </div>
                  <div className="work-controls">
                    <div className="tabs-line">
                      {['All', 'Needs review', 'Content', 'Done'].map((t) => (
                        <button key={t} className={tab === t ? 'is-active' : ''} onClick={() => setTab(t)}>{t}</button>
                      ))}
                    </div>
                    <label className="search-box"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find work" aria-label="Find work" /></label>
                  </div>
                  {queue.length ? queue.map((r) => (
                    <button className="record-row" key={r.id} onClick={() => { if(readHeld(r)) go('inbox'); else setSelected(r.id); }}>
                      <span className={`record-icon${r.priority === 'High' ? ' important' : ''}`}>{r.status === 'Done' ? <CheckCircle size={19} /> : <Circle size={19} />}</span>
                      <span className="record-copy"><strong>{r.title}</strong>{readHeld(r) && <small>{(() => {const p=readHeld(r)!;const i=inquiries.find(i=>i.id===p.inquiry);return i?heldStatus(p,i):'Held review · inquiry unavailable';})()}</small>}<Tags ids={r.properties} /></span>
                      <span className={`status${r.status === 'Needs review' ? ' review' : ''}`}>{r.status}</span>
                      <span className="row-owner">{r.owner || 'Unassigned'}</span>
                      <ChevronRight size={16} className="dim" />
                    </button>
                  )) : <div className="empty"><CheckCircle size={28} /><h3>No work in this view</h3></div>}
                </section>
              </div>
            </>
          )}
        </main>
      </div>

      {current && (
        <div className="tower-sheet" role="dialog">
          <button className="sheet-dismiss" onClick={() => setSelected(null)}>Close</button>
          <RecordEditor item={current} save={send} busy={saveBusy} />
        </div>
      )}
      {add && (
        <div className="tower-sheet" role="dialog">
          <button className="sheet-dismiss" onClick={() => setAdd(false)}>Close</button>
          <CreateForm defaultProperty={property?.id || 'RyanThe1'} busy={saveBusy} onSave={async (r) => { if (await send({ type: 'createRecord', record: r })) setAdd(false); }} />
        </div>
      )}
      {promptId && (
        <div className="tower-sheet" role="dialog">
          <button className="sheet-dismiss" onClick={() => setPromptId(null)}>Close</button>
          <SetupForm key={promptId} id={promptId} answer={state.answers[promptId]?.values} busy={saveBusy} onSave={async (values) => {
            if (await send({ type: 'saveSetup', id: promptId, values })) {
              const i = prompts.findIndex((p) => p.id === promptId);
              setPromptId(prompts[i + 1]?.id || null);
            }
          }} />
        </div>
      )}
      {notice && <output className="toast"><CheckCircle size={18} />{notice}<button aria-label="Dismiss" onClick={() => setNotice('')}>×</button></output>}
    </div>
  );
}


function Inbox({ records, sharedAvailable, onSaveHeld, onReviewHeld, inquiries, error, ready, deskStatus, onNotice, onReload }: {
  records: RecordItem[]; sharedAvailable: boolean; onSaveHeld: HeldSave; onReviewHeld: (i:Inquiry,r:RecordItem,p:HeldPacket)=>Promise<boolean>;
  inquiries: Inquiry[]; error: string; ready: boolean; deskStatus: DeskStatus;
  onNotice: (s: string) => void; onReload: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  async function review(i: Inquiry, decision: 'reviewed' | 'needs_changes') {
    const { draft, canReview } = deskPresentation(i, ryanDateStatus(i));
    if (!draft?.id || !canReview) return;
    setBusy(true);
    try {
      await reviewReply({ inquiry_id: i.id, expected_revision: i.revision, draft_id: draft.id, decision });
      onNotice('Review saved. Reply remains held. Date is not reserved.');
      await onReload();
    } catch (e) {
      onNotice(e instanceof Error ? e.message : 'Could not review.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="inbox-shell">
      <div className="inbox-toolbar">
        <p>{ready ? (deskStatus === 'connected' ? `${inquiries.length} live website inquir${inquiries.length === 1 ? 'y' : 'ies'}` : deskBanner(deskStatus)) : 'Opening the booking desk…'}</p>
        <button className="button" onClick={() => void onReload()}>Refresh</button>
      </div>
      {error && <p className="inbox-alert">{error}</p>}
      {inquiries.map((i) => {
        const summary = deskPresentation(i, ryanDateStatus(i));
        const { draft, sent } = summary;
        return (
          <article className="panel inbox-section" key={i.id}>
            <div className="top">
              <h2>{i.facts.title}</h2>
              <span className="pill">{ryanDateStatus(i)}</span>
            </div>
            <p>{i.facts.local_date || 'date TBD'} · {i.facts.local_start || 'time TBD'}–{i.facts.local_end || 'end TBD'} · {i.facts.event_timezone || 'timezone unconfirmed'} · {i.facts.venue || 'venue TBD'}</p>
            <section className="inbox-next" aria-label="Next action"><span className="eyebrow">NEXT ACTION</span><h3>{inquiryAction(i, records)}</h3><p>Review work is below. The date is not reserved.</p></section>
            <dl className="desk-summary"><dt>Owner</dt><dd>{summary.owner}</dd><dt>Calendar assessment</dt><dd>{ryanDateStatus(i)}</dd><dt>Customer correspondence</dt><dd>{summary.reply}</dd><dt>Notifications</dt><dd>{summary.notification}</dd></dl>
            <p className="muted">{i.facts.contact_name} · {replyLabel(i)} · date not reserved</p>
            {i.facts.notes && <details><summary>Event facts and source history</summary><pre className="inbox-source">{i.facts.notes}</pre></details>}
            {draft?.body && <details><summary>{sent ? "Earlier reply — do not resend" : "Intake reply history"}</summary><pre className="inbox-source">{draft.body}</pre></details>}
            {sent ? <p className="muted">Customer reply already sent by human. Do not send again.</p> : summary.canReview ? (
              <div className="inbox-reply">
                <button className="button primary" disabled={busy} onClick={() => void review(i, 'reviewed')}>Mark reviewed — keep held</button>
                <button className="button" disabled={busy} onClick={() => void review(i, 'needs_changes')}>Needs changes</button>
              </div>
            ) : null}
            <HeldWork inquiry={i} records={records} available={sharedAvailable} onSave={onSaveHeld} onReview={onReviewHeld}/>
          </article>
        );
      })}
      {ready && deskStatus === 'connected' && !inquiries.length && !error && <p className="muted">No live website inquiries yet.</p>}
    </section>
  );
}

function Setup({ state, done, nextPrompt, theme, setTheme, setPromptId, shared }: {
  state: State; done: number; nextPrompt: typeof prompts[number]; theme: string;
  setTheme: (v: string) => void; setPromptId: (id: string) => void; shared: boolean;
}) {
  return (
    <>
      <div className="setup-summary panel">
        <div>
          <span className="eyebrow">MAKE IT YOURS</span>
          <h2>{done === prompts.length ? 'Your setup packet is ready for review.' : `${done} of ${prompts.length} prompts answered`}</h2>
          <p>{shared ? 'Saved to the shared desk when this operator link is authorized. A copy remains on this device. Identity and live connections still need verification.' : 'Saved on this device. Identity, ownership and live connections require separate verification. Hosting is GitHub + Netlify/desk — not a ChatGPT Site.'}</p>
        </div>
        <button className="button primary" onClick={() => setPromptId(nextPrompt.id)}>{done ? 'Continue setup' : 'Start with your first win'}<ArrowRight size={16} /></button>
      </div>
      <div className="setup-grid">
        {prompts.map((p, i) => (
          <button key={p.id} className="setup-card panel" onClick={() => setPromptId(p.id)}>
            <span className={`step-number${state.answers[p.id] ? ' answered' : ''}`}>{state.answers[p.id] ? <Check size={17} /> : String(i + 1).padStart(2, '0')}</span>
            <div>
              <h3>{p.title}</h3>
              <p>{p.question}</p>
              <span className={state.answers[p.id] ? 'saved-label' : 'dim'}>{state.answers[p.id] ? 'Details saved · needs verification' : 'Your input needed'}</span>
            </div>
          </button>
        ))}
      </div>
      <div className="panel preference-row">
        <div><h3>Make it comfortable</h3><p>Dark by default.</p></div>
        <select className="choice" value={theme} onChange={(e) => setTheme(e.target.value)} aria-label="Color theme">
          <option value="dark">dark</option>
          <option value="light">light</option>
          <option value="system">system</option>
        </select>
      </div>
    </>
  );
}

function RecordEditor({ item, save, busy }: { item: RecordItem; save: (c: Command) => Promise<boolean>; busy: boolean }) {
  const [title, setTitle] = useState(item.title);
  const [status, setStatus] = useState<Status>(item.status);
  const [owner, setOwner] = useState(item.owner);
  const [due, setDue] = useState(item.due);
  const [note, setNote] = useState(item.note);
  const [linked, setLinked] = useState(item.properties);
  return (
    <div className="sheet-body">
      <div className="eyebrow">{item.provenance} RECORD</div>
      <h2 className="sheet-title">{item.title}</h2>
      <div className="context-box">{item.detail}</div>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); void save({ type: 'updateRecord', id: item.id, patch: { title, status, owner, due, note, properties: linked } }); }}>
        <label className="field">Title<input required maxLength={180} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <label className="field">Status
          <select className="choice" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
            {statuses.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="field">Responsible person<input value={owner} maxLength={100} onChange={(e) => setOwner(e.target.value)} /></label>
        <label className="field">Due date<input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></label>
        <fieldset>
          <legend>Related properties</legend>
          <div className="property-picker">
            {properties.map((p) => (
              <label key={p.id}>
                <input type="checkbox" checked={linked.includes(p.id)} onChange={(e) => setLinked(e.target.checked ? [...linked, p.id] : linked.filter((id) => id !== p.id))} />
                <i style={{ background: p.color }} />{p.name}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="field">Notes<textarea rows={4} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} /></label>
        <button className="button primary full" disabled={busy || linked.length === 0}>{busy ? 'Saving…' : 'Save shared record'}<Check size={16} /></button>
      </form>
    </div>
  );
}

function CreateForm({ defaultProperty, onSave, busy }: { defaultProperty: PropertyId; busy: boolean; onSave: (r: { title: string; kind: 'task' | 'idea' | 'opportunity'; properties: PropertyId[]; note: string }) => Promise<void> }) {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'task' | 'idea' | 'opportunity'>('idea');
  const [linked, setLinked] = useState<PropertyId[]>([defaultProperty]);
  const [note, setNote] = useState('');
  return (
    <form className="sheet-body" onSubmit={(e) => { e.preventDefault(); void onSave({ title, kind, properties: linked, note }); }}>
      <h2>Add to the Universe</h2>
      <label className="field">What’s the idea or next move?<input required value={title} maxLength={180} onChange={(e) => setTitle(e.target.value)} /></label>
      <label className="field">Type
        <select className="choice" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          <option value="task">task</option>
          <option value="idea">idea</option>
          <option value="opportunity">opportunity</option>
        </select>
      </label>
      <fieldset>
        <legend>Where does it belong?</legend>
        <div className="property-picker">
          {properties.map((p) => (
            <label key={p.id}>
              <input type="checkbox" checked={linked.includes(p.id)} onChange={(e) => setLinked(e.target.checked ? [...linked, p.id] : linked.filter((id) => id !== p.id))} />
              {p.name}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="field">A little context<textarea rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <button className="button primary full" disabled={busy || !linked.length}>{busy ? 'Saving…' : 'Add shared record'}<Plus size={16} /></button>
    </form>
  );
}

function SetupForm({ id, answer, onSave, busy }: { id: string; answer?: Record<string, string>; busy: boolean; onSave: (v: Record<string, string>) => Promise<void> }) {
  const p = prompts.find((x) => x.id === id)!;
  const [values, setValues] = useState<Record<string, string>>(() => setupValues(id, answer));
  useEffect(() => {
    setValues(setupValues(id, answer));
  }, [id, answer]);
  return (
    <div className="sheet-body">
      <div className="eyebrow">MAKE IT LIVE · {prompts.findIndex((x) => x.id === id) + 1} OF {prompts.length}</div>
      <h2>{p.title}</h2>
      <p className="small-note">{p.description}</p>
      <form onSubmit={(e) => { e.preventDefault(); void onSave(values); }}>
        {p.fields.map((f) => (
          <label className="field" key={f.key}>
            {f.label}{f.required && <span className="required">Required</span>}
            {f.type === 'textarea'
              ? <textarea rows={3} required={f.required} maxLength={2000} value={values[f.key]} placeholder={f.placeholder} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
              : <input type={f.type === 'url' ? 'url' : 'text'} required={f.required} maxLength={2000} value={values[f.key]} placeholder={f.placeholder} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />}
          </label>
        ))}
        <button className="button primary full" disabled={busy}>{busy ? 'Saving…' : 'Save details & continue'}<ArrowRight size={16} /></button>
      </form>
    </div>
  );
}

