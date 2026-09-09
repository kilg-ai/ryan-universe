import { FormEvent, useEffect, useState } from 'react';
import {
  ArrowRight, ArrowUpRight, CalendarDays, Check, CheckCircle, ChevronRight, Circle,
  LayoutGrid, Orbit, Play, Plus, Search, ShieldCheck, Sparkles,
} from 'lucide-react';
import { loadInbox, operatorKey, reviewReply } from './desk';
import {
  applyCommand, initialState, prompts, properties, statuses, todayBriefing,
  type Command, type PropertyId, type RecordItem, type State, type Status,
} from './lib/model';
import { ryanDateStatus, type Inquiry } from './lib/inquiries';

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
  const [state, setState] = useState<State>(() => loadState());
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
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    setSignedIn(Boolean(operatorKey()));
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches));
    localStorage.setItem('r1-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(WORK, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    const controller = new AbortController();
    loadInbox()
      .then((d) => {
        if (controller.signal.aborted) return;
        setInquiries((d.inquiries as Inquiry[]) || []);
        setInboxError(d.error || '');
        setInboxReady(true);
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        setInboxError(e instanceof Error ? e.message : 'Could not open the live inbox.');
        setInboxReady(true);
      });
    return () => controller.abort();
  }, []);

  function send(command: Command) {
    try {
      const next = applyCommand(state, command);
      setState(next);
      setNotice(command.type === 'saveSetup' ? 'Setup details saved on this device · verification still needed.' : 'Saved on this device.');
      return true;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not save.');
      return false;
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
  const filtered = state.records.filter((r) =>
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
          <div><strong>Ryan the 1 LLC</strong><small>{signedIn ? 'Operator signed in' : 'Private control tower'}</small></div>
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
              <p>{view === 'today' ? 'RyanThe1 is the hub, not the owner of every record. Today reads the whole Universe.' : view === 'inbox' ? 'Live inquiries from the dedicated Ryan desk. Nothing is sent from here.' : view === 'setup' ? 'Answers stay on this device until the GitHub/Netlify host is the daily driver.' : view === 'universe' ? 'Six properties. Shared people, content and possibilities.' : property?.description}</p>
            </div>
            {view !== 'inbox' && <button className="button primary" onClick={() => setAdd(true)}><Plus size={17} />Add to the Universe</button>}
          </div>
          <div className={`state-strip${inboxError && signedIn ? ' error' : ''}`}>
            <span><i />{signedIn ? 'Live booking desk connected' : 'Demo workspace · add your operator link to load the live inbox'}</span>
            <span>{inquiries.length} live inquir{inquiries.length === 1 ? 'y' : 'ies'} · {done} setup answers on this device</span>
          </div>

          {view === 'inbox' ? (
            <Inbox inquiries={inquiries} error={inboxError} ready={inboxReady} signedIn={signedIn} onNotice={setNotice} onReload={async () => {
              try {
                const d = await loadInbox();
                setInquiries((d.inquiries as Inquiry[]) || []);
                setInboxError(d.error || '');
              } catch (e) {
                setInboxError(e instanceof Error ? e.message : 'Could not refresh.');
              }
            }} />
          ) : view === 'setup' ? (
            <Setup state={state} done={done} nextPrompt={nextPrompt} theme={theme} setTheme={setTheme} setPromptId={setPromptId} />
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
                    <p>{liveInquiry.facts.title} · Ryan TheOne {ryanDateStatus(liveInquiry)} · {liveInquiry.reply_drafts.length ? 'reply held' : 'needs reply'}</p>
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
                    <button className="record-row" key={r.id} onClick={() => setSelected(r.id)}>
                      <span className={`record-icon${r.priority === 'High' ? ' important' : ''}`}>{r.status === 'Done' ? <CheckCircle size={19} /> : <Circle size={19} />}</span>
                      <span className="record-copy"><strong>{r.title}</strong><Tags ids={r.properties} /></span>
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
          <RecordEditor item={current} save={send} />
        </div>
      )}
      {add && (
        <div className="tower-sheet" role="dialog">
          <button className="sheet-dismiss" onClick={() => setAdd(false)}>Close</button>
          <CreateForm defaultProperty={property?.id || 'RyanThe1'} onSave={(r) => { if (send({ type: 'createRecord', record: r })) setAdd(false); }} />
        </div>
      )}
      {promptId && (
        <div className="tower-sheet" role="dialog">
          <button className="sheet-dismiss" onClick={() => setPromptId(null)}>Close</button>
          <SetupForm id={promptId} answer={state.answers[promptId]?.values} onSave={(values) => {
            if (send({ type: 'saveSetup', id: promptId, values })) {
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


function Inbox({ inquiries, error, ready, signedIn, onNotice, onReload }: {
  inquiries: Inquiry[]; error: string; ready: boolean; signedIn: boolean;
  onNotice: (s: string) => void; onReload: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  async function review(i: Inquiry, decision: 'reviewed' | 'needs_changes') {
    const draft = i.reply_drafts[0];
    if (!draft) return;
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
        <p>{ready ? (signedIn ? `${inquiries.length} live website inquir${inquiries.length === 1 ? 'y' : 'ies'}` : 'Open this page from the private operator link to load live inquiries.') : 'Opening the booking desk…'}</p>
        <button className="button" onClick={() => void onReload()}>Refresh</button>
      </div>
      {error && <p className="inbox-alert">{error}</p>}
      {inquiries.map((i) => {
        const draft = i.reply_drafts[0];
        const sent = Boolean(i.source.prior_response);
        return (
          <article className="panel inbox-section" key={i.id}>
            <div className="top">
              <h2>{i.facts.title}</h2>
              <span className="pill">{ryanDateStatus(i)}</span>
            </div>
            <p>{i.facts.local_date || 'date TBD'} · {i.facts.venue || 'venue TBD'}</p>
            <p className="muted">{i.facts.contact_name} · {sent ? 'sent by human' : draft ? 'reply held' : 'needs reply'} · date not reserved</p>
            {i.facts.notes && <pre className="inbox-source">{i.facts.notes}</pre>}
            {draft?.body && <pre className="inbox-source">{draft.body}</pre>}
            {sent ? <p className="muted">Customer reply already sent by human. Do not send again.</p> : draft ? (
              <div className="inbox-reply">
                <button className="button primary" disabled={busy} onClick={() => void review(i, 'reviewed')}>Mark reviewed — keep held</button>
                <button className="button" disabled={busy} onClick={() => void review(i, 'needs_changes')}>Needs changes</button>
              </div>
            ) : null}
          </article>
        );
      })}
      {ready && signedIn && !inquiries.length && !error && <p className="muted">No live website inquiries yet.</p>}
    </section>
  );
}

function Setup({ state, done, nextPrompt, theme, setTheme, setPromptId }: {
  state: State; done: number; nextPrompt: typeof prompts[number]; theme: string;
  setTheme: (v: string) => void; setPromptId: (id: string) => void;
}) {
  return (
    <>
      <div className="setup-summary panel">
        <div>
          <span className="eyebrow">MAKE IT YOURS</span>
          <h2>{done === prompts.length ? 'Your setup packet is ready for review.' : `${done} of ${prompts.length} prompts answered`}</h2>
          <p>Saved on this device. Identity, ownership and live connections require separate verification. Hosting is GitHub + Netlify/desk — not a ChatGPT Site.</p>
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

function RecordEditor({ item, save }: { item: RecordItem; save: (c: Command) => boolean }) {
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
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); save({ type: 'updateRecord', id: item.id, patch: { title, status, owner, due, note, properties: linked } }); }}>
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
        <button className="button primary full" disabled={linked.length === 0}>Save shared record<Check size={16} /></button>
      </form>
    </div>
  );
}

function CreateForm({ defaultProperty, onSave }: { defaultProperty: PropertyId; onSave: (r: { title: string; kind: 'task' | 'idea' | 'opportunity'; properties: PropertyId[]; note: string }) => void }) {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'task' | 'idea' | 'opportunity'>('idea');
  const [linked, setLinked] = useState<PropertyId[]>([defaultProperty]);
  const [note, setNote] = useState('');
  return (
    <form className="sheet-body" onSubmit={(e) => { e.preventDefault(); onSave({ title, kind, properties: linked, note }); }}>
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
      <button className="button primary full" disabled={!linked.length}>Add shared record<Plus size={16} /></button>
    </form>
  );
}

function SetupForm({ id, answer, onSave }: { id: string; answer?: Record<string, string>; onSave: (v: Record<string, string>) => void }) {
  const p = prompts.find((x) => x.id === id)!;
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(p.fields.map((f) => [f.key, answer?.[f.key] ?? f.defaultValue ?? ''])));
  return (
    <div className="sheet-body">
      <div className="eyebrow">MAKE IT LIVE · {prompts.findIndex((x) => x.id === id) + 1} OF {prompts.length}</div>
      <h2>{p.title}</h2>
      <p className="small-note">{p.description}</p>
      <form onSubmit={(e) => { e.preventDefault(); onSave(values); }}>
        {p.fields.map((f) => (
          <label className="field" key={f.key}>
            {f.label}{f.required && <span className="required">Required</span>}
            {f.type === 'textarea'
              ? <textarea rows={3} required={f.required} maxLength={2000} value={values[f.key]} placeholder={f.placeholder} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
              : <input type={f.type === 'url' ? 'url' : 'text'} required={f.required} maxLength={2000} value={values[f.key]} placeholder={f.placeholder} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />}
          </label>
        ))}
        <button className="button primary full">Save details & continue<ArrowRight size={16} /></button>
      </form>
    </div>
  );
}

