import { replyLabel, ryanDateStatus, type Inquiry } from './inquiries.ts';
export const properties = [
  {id:'RyanThe1',name:'RyanThe1',label:'The public hub',mark:'R1',color:'#c1ef77',description:'Identity, events, bookings and the work that brings everything together.',tracks:['Events & bookings','Public website','Client relationships']},
  {id:'YouTube',name:'YouTube',label:'The main platform',mark:'YT',color:'#ff8585',description:'Programming, videos, Shorts, performance and the next audience opportunity.',tracks:['Videos & Shorts','Production pipeline','Growth & monetization']},
  {id:'GSB',name:'GSB',label:'Project & business',mark:'GSB',color:'#b3a2ff',description:'A dedicated workspace for GSB, its projects and its relationship to Ryan.',tracks:['Projects & tasks','Relationships','Opportunities']},
  {id:'19U',name:'19U',label:'Artists & releases',mark:'19U',color:'#87bcff',description:'From artist discovery to the roster, mixtape, sessions and releases.',tracks:['19U Roster','19U Mixtape','Sessions & promotion']},
  {id:'SupportYouthDJs',name:'Support Youth DJs',label:'The community',mark:'SYD',color:'#fac37a',description:'Young DJs, shared stages, community stories and new partnerships.',tracks:['DJ submissions','Campaigns & merch','Partners & sponsors']},
  {id:'HipHopColoringPages',name:'HipHopColoringPages',label:'Content, products & IP',mark:'HCP',color:'#e99cdc',description:'Creative products, the website, traffic, sales and new uses for the catalog.',tracks:['Products & content','Site & traffic','Rights & opportunities']},
] as const;
export type PropertyId = typeof properties[number]['id'];
export type Status = 'Needs review'|'In progress'|'Planned'|'Done';
export type Kind = 'event'|'video'|'submission'|'task'|'media'|'opportunity'|'idea';
export type RecordItem = {id:string;title:string;kind:Kind;properties:PropertyId[];status:Status;owner:string;due:string;note:string;sourceId?:string;provenance:'Demo'|'User supplied';priority:'High'|'Normal';detail:string;revision?:number;importNativeId?:string};
export type Answer = {values:Record<string,string>;savedAt:string;status:'Details saved · Not verified';revision?:number};
export type State = {records:RecordItem[];answers:Record<string,Answer>;activity:{id:string;text:string;at:string}[]};
export type Field = {key:string;label:string;placeholder?:string;defaultValue?:string;type?:'text'|'url'|'textarea';required?:boolean};
export const prompts: {id:string;title:string;question:string;description:string;property?:PropertyId;fields:Field[];link?:{label:string;url:string}}[] = [
 {id:'priority',title:'Your first useful win',question:'What would make this useful to you this week?',description:'Keep the first live workflow focused. We can refine the rest as you use it.',fields:[{key:'outcome',label:'First outcome',placeholder:'For example: run YouTube and track all submissions from Today',type:'textarea',required:true},{key:'owner',label:'Who will use this most?',placeholder:'Ryan, Ronald, or both',required:true}]},
 {id:'RyanThe1',title:'RyanThe1.com',property:'RyanThe1',question:'What should the public hub do first?',description:'Connect the website’s work to the rest of the Universe.',fields:[{key:'url',label:'Public website',type:'url',defaultValue:'https://ryanthe1.com',required:true},{key:'outcome',label:'First workflow',placeholder:'Booking inquiry → event → content',required:true},{key:'owner',label:'Who manages the website?',required:true}]},
 {id:'YouTube',title:'YouTube channel',property:'YouTube',question:'Which channel are we building around?',description:'A public channel address helps identify the account. It does not connect analytics or publishing.',fields:[{key:'url',label:'Public channel URL',type:'url',placeholder:'https://www.youtube.com/@…',required:true},{key:'owner',label:'Who manages channel access?',required:true},{key:'outcome',label:'Next video, Short or programming goal',type:'textarea',required:true},{key:'data',label:'Available performance data',placeholder:'Studio access, export available, or unknown'}],link:{label:'Open YouTube Studio',url:'https://studio.youtube.com/'}},
 {id:'GSB',title:'GSB',property:'GSB',question:'What is GSB, and what needs to happen next?',description:'Give this workspace its real purpose and first project.',fields:[{key:'purpose',label:'Describe GSB',type:'textarea',required:true},{key:'outcome',label:'Current project or next outcome',required:true},{key:'owner',label:'Responsible person',required:true},{key:'url',label:'Public website, if any',type:'url'}]},
 {id:'19U',title:'19U · Roster & Mixtape',property:'19U',question:'Where should the artist workflow start?',description:'Keep participant information and media permissions scoped to their intended use.',fields:[{key:'outcome',label:'Roster, Mixtape or both?',required:true},{key:'source',label:'Where do submissions arrive?',placeholder:'Public form URL or tool name; no private submissions',required:true},{key:'owner',label:'Who reviews artists and releases?',required:true},{key:'sharing',label:'What may appear on RyanThe1 or YouTube?',type:'textarea'}]},
 {id:'SupportYouthDJs',title:'Support Youth DJs',property:'SupportYouthDJs',question:'What is the next community activity?',description:'Start with one submission, campaign, merch project or partnership flow.',fields:[{key:'outcome',label:'First activity',required:true},{key:'source',label:'Submission source or public form',required:true},{key:'owner',label:'Review and permission owner',required:true},{key:'sharing',label:'Permitted use of resulting content',type:'textarea'}]},
 {id:'HipHopColoringPages',title:'HipHopColoringPages',property:'HipHopColoringPages',question:'What should we connect first?',description:'Bring the site, creative catalog, products and opportunities into one workspace.',fields:[{key:'url',label:'Public website',type:'url',defaultValue:'https://hiphopcoloringpages.com',required:true},{key:'outcome',label:'First product, content or traffic goal',required:true},{key:'owner',label:'Who manages the site and IP?',required:true},{key:'source',label:'Catalog or reporting tool',placeholder:'Tool name or approved evidence reference'}]},
 {id:'organization',title:'Ryan the 1 LLC',question:'Who is responsible for each protected decision?',description:'These answers prepare review. They do not establish identity, legal authority or ownership.',fields:[{key:'organization',label:'Organization name',defaultValue:'Ryan the 1 LLC',required:true},{key:'owner',label:'Designated adult',defaultValue:'Ronald Kilgore Jr',required:true},{key:'relationships',label:'Relationship to each property',type:'textarea',required:true},{key:'reviewer',label:'Independent authority reviewer',required:true},{key:'delegate',label:'Emergency delegate',required:true},{key:'evidence',label:'Evidence reference only',placeholder:'Document title or approved storage location; no IDs or files'}]},
 {id:'supabase',title:'Shared backend',question:'Which Supabase project should become the live home?',description:'The preview saves your answers privately. The future operational backend remains Supabase; no connection is made by this form. Recommended: a dedicated Ryan the 1 organization with an authorized adult owner and separate eligible personal logins. Keep the existing website repository in place during testing.',fields:[{key:'project',label:'Existing project name, or “new project needed”',required:true},{key:'owner',label:'Adult owner account / email',required:true},{key:'github',label:'Existing GitHub repository URL or owner/repository',placeholder:'Keep the current repository for testing'},{key:'ryan',label:'Ryan’s separate login / planned role',placeholder:'User supplied; eligibility and permissions to review'},{key:'region',label:'Region preference or “review needed”',required:true},{key:'budget',label:'Approved monthly budget or “not approved”',required:true},{key:'reviewer',label:'Connection and access reviewer',required:true}],link:{label:'Open Supabase dashboard',url:'https://supabase.com/dashboard'}},
 {id:'review',title:'Review the live handoff',question:'What should be verified and connected first?',description:'Save the requested scope. Accounts, permissions, recovery and any real transactions still require observed verification.',fields:[{key:'outcome',label:'First connection and allowed actions',type:'textarea',required:true},{key:'owner',label:'Review owner',required:true},{key:'next',label:'Next review checkpoint',placeholder:'Date or what must happen first',required:true}]},
];
export function setupValues(id:string,answer?:Record<string,string>):Record<string,string>{
 const p=prompts.find(x=>x.id===id);if(!p)throw new Error('Unknown setup step.');
 return Object.fromEntries(p.fields.map(f=>[f.key,answer?.[f.key]??f.defaultValue??'']));
}
export const statuses:Status[]=['Needs review','In progress','Planned','Done'];
const record=(id:string,title:string,kind:Kind,props:PropertyId[],detail:string,status:Status='Needs review',priority:'High'|'Normal'='Normal'):RecordItem=>({id,title,kind,properties:props,status,priority,detail,owner:'Ronald',due:'',note:'',provenance:'Demo'});
export function initialState():State { return {answers:{},activity:[],records:[
 {...record('event-1','Saturday community set','event',['RyanThe1'],'Demo event · September 12 · retainer outstanding. Review the booking and prepare content opportunities. No real booking or charge.','Needs review','High'),owner:'Ronald',due:'2026-09-12'},
 {...record('video-1','The community set · full mix','video',['YouTube','RyanThe1'],'Demo comparison: 12,400 views vs 7,800 baseline, first 7 days, same video format. Explore a follow-up and Shorts.','Needs review','High'),owner:'Ryan'},
 record('artist-1','Review artist demo 01','submission',['19U'],'Demo artist submission for 19U Roster. Identity and releases are not real.'),
 record('artist-2','Review artist demo 02','submission',['19U'],'Demo submission with a Mixtape opportunity. Review before creating a programming idea.'),
 record('artist-3','Review artist demo 03','submission',['19U'],'Demo roster submission waiting for a first listen.'),
 record('dj-1','Meet the next youth DJ','submission',['SupportYouthDJs'],'Demo community submission. Prepare a review; do not assume media or guardian permission.'),
 record('traffic-1','Explore the coloring-page traffic lift','opportunity',['HipHopColoringPages'],'Demo: 1,280 sessions vs 1,000 in the prior equal 7-day window. Identify a catalog story worth sharing.'),
 record('gsb-1','Define GSB’s next project','task',['GSB'],'Describe GSB and choose its first useful outcome. The setup prompt is ready.'),
 {...record('media-1','Behind the decks · vertical clip','media',['RyanThe1','YouTube','SupportYouthDJs'],'Demo 24-second clip. A shared asset can generate a Short or community-story draft; real use requires a release.'),owner:'Ryan'},
 {...record('media-2','Artist session · studio cut','media',['19U','YouTube'],'Demo session footage linked to 19U Mixtape. Create a programming draft without copying the original record.'),owner:'Ryan'},
 {...record('media-3','Color the beat · process reel','media',['HipHopColoringPages','YouTube'],'Demo catalog process footage. Potential product story and Short, with rights review before publishing.'),owner:'Ryan'},
 {...record('video-2','From soundcheck to showtime','video',['YouTube','RyanThe1'],'Demo long-form episode in production.', 'In progress'),owner:'Ryan'},
 {...record('video-3','30 seconds behind the decks','video',['YouTube','SupportYouthDJs'],'Demo Short in the programming queue.', 'Planned'),owner:'Ryan'},
]}; }
export type BriefingItem = {id:string;recordId:string;view:string;headline:string;detail:string;properties:PropertyId[];provenance:RecordItem['provenance']};
function weekday(due:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(due))return due;
 const day=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date(due+'T12:00:00Z').getUTCDay()];
 return day+' '+due;
}
export function todayInquiryLine(i:Inquiry):BriefingItem{
 const f=i.facts;
 const keys=i.property_keys.filter((k):k is PropertyId=>properties.some(p=>p.id===k));
 const propertiesForLine:PropertyId[]=keys.length?keys:['RyanThe1'];
 const slot=[f.local_start,f.local_end].filter(Boolean).join('–')||'time TBD';
 return {id:'brief-inq-'+i.id,recordId:i.id,view:'inbox',headline:f.title+(f.local_date?' · '+weekday(f.local_date):''),detail:[f.venue||'Venue TBD',slot,'Ryan TheOne '+ryanDateStatus(i),replyLabel(i)].join(' · '),properties:propertiesForLine,provenance:'User supplied'};
}
function normBriefText(value:string){
 return value.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}
/** True when a workspace event is the same booking already represented by an inquiry line. */
export function eventCoveredByInquiry(r:RecordItem,inquiries:Inquiry[]):boolean{
 if(r.kind!=='event'||!inquiries.length)return false;
 if(r.sourceId&&inquiries.some(i=>i.id===r.sourceId))return true;
 const recordTitle=normBriefText(r.title);
 if(!recordTitle)return false;
 return inquiries.some(i=>{
  const title=normBriefText(i.facts.title||'');
  const contact=normBriefText(i.facts.contact_name||'');
  if(title&&(recordTitle===title||recordTitle.includes(title)||title.includes(recordTitle)))return true;
  if(contact&&contact.split(' ').filter(Boolean).length>=1&&recordTitle.includes(contact))return true;
  return false;
 });
}
export function todayBriefing(records:RecordItem[],inquiries:Inquiry[]=[]):BriefingItem[]{
 const items:BriefingItem[]=inquiries.map(todayInquiryLine);
 const hideDemoEvents=inquiries.length>0;
 const open=records.filter(r=>r.status!=='Done'&&!(hideDemoEvents&&r.provenance==='Demo'&&r.kind==='event'));
 const line=(r:RecordItem,headline:string,detail:string,view?:string):BriefingItem=>({id:'brief-'+r.id,recordId:r.id,view:view||(r.properties.includes('YouTube')&&r.kind==='video'?'YouTube':r.properties[0]||'today'),headline,detail,properties:r.properties,provenance:r.provenance});
 // Inquiry evidence wins: do not also show a copied/linked event for the same booking.
 for(const r of open.filter(r=>r.kind==='event'&&!eventCoveredByInquiry(r,inquiries)))items.push(line(r,r.title+(r.due?' · '+weekday(r.due):''),r.detail,r.properties[0]||'today'));
 for(const r of open.filter(r=>r.kind==='video'&&r.priority==='High'))items.push(line(r,r.title,r.detail,'YouTube'));
 const artists=open.filter(r=>r.kind==='submission'&&r.properties.includes('19U'));
 if(artists.length)items.push(line(artists[0],artists.length+' 19U artist '+(artists.length===1?'submission':'submissions')+' need review','Same records. No duplicate artist rows. Review before programming or publishing.','19U'));
 const community=open.filter(r=>r.kind==='submission'&&r.properties.includes('SupportYouthDJs'));
 if(community.length)items.push(line(community[0],community.length===1?community[0].title:community.length+' Support Youth DJs submissions',community[0].detail,'SupportYouthDJs'));
 for(const r of open.filter(r=>r.kind==='opportunity'&&r.properties.includes('HipHopColoringPages')))items.push(line(r,r.title,r.detail,'HipHopColoringPages'));
 for(const r of open.filter(r=>r.kind==='task'&&r.properties.includes('GSB')))items.push(line(r,r.title,r.detail,'GSB'));
 const media=open.filter(r=>r.kind==='media');
 if(media.length)items.push(line(media[0],media.length+' existing '+(media.length===1?'asset':'assets')+' can travel today','One source record. YouTube, hub and community drafts stay linked, not copied.','work'));
 return items;
}
export type Command = {type:'saveSetup';id:string;values:Record<string,string>} | {type:'updateRecord';id:string;patch:Partial<Pick<RecordItem,'title'|'status'|'owner'|'due'|'note'|'properties'>>} | {type:'createRecord';record:Pick<RecordItem,'title'|'kind'|'properties'|'note'>} | {type:'createDraft';id:string;destination:PropertyId};
const clean=(v:unknown,max=2000)=>{if(typeof v!=='string'||v.length>max)throw new Error('Please shorten the entry.');return v.trim();};
function propertyList(v:unknown):PropertyId[]{if(!Array.isArray(v)||v.length<1||v.length>6||v.some(p=>!properties.some(x=>x.id===p)))throw new Error('Choose at least one valid property.');return [...new Set(v)] as PropertyId[];}
export function applyCommand(current:State,input:Command,now=new Date().toISOString()):State {
 const state=structuredClone(current);let message='';
 if(!input||typeof input!=='object')throw new Error('Invalid request.');
 if(input.type==='saveSetup'){
  const p=prompts.find(x=>x.id===input.id);if(!p||!input.values||typeof input.values!=='object')throw new Error('Unknown setup step.');
  const values:Record<string,string>={};for(const f of p.fields){const value=clean(input.values[f.key]??'');if(f.required&&!value)throw new Error(`Complete ${f.label.toLowerCase()}.`);if(f.type==='url'&&value){let url:URL;try{url=new URL(value)}catch{throw new Error('Enter a full public https:// address.')}if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new Error('Use a public https:// address without credentials or query parameters.');}if(/-----BEGIN|\b(sk_live_|sk_test_|sb_secret_|sb_publishable_|eyJ[a-zA-Z0-9_-]{25,})/i.test(value))throw new Error('Use a reference, not a key or credential.');values[f.key]=value;}
  state.answers[p.id]={values,savedAt:now,status:'Details saved · Not verified'};message=`Saved setup details · ${p.title}`;
 }else if(input.type==='updateRecord'){
  const r=state.records.find(x=>x.id===input.id);if(!r)throw new Error('Record no longer exists.');const p=input.patch;
  if(!p||typeof p!=='object')throw new Error('Invalid change.');
  if(p.title!==undefined){r.title=clean(p.title,180);if(!r.title)throw new Error('Give this record a title.');}
  if(p.status!==undefined){if(!statuses.includes(p.status))throw new Error('Unknown status.');r.status=p.status;}
  if(p.owner!==undefined)r.owner=clean(p.owner,100);
  if(p.note!==undefined)r.note=clean(p.note);
  if(p.due!==undefined){r.due=clean(p.due,10);if(r.due&&!/^\d{4}-\d{2}-\d{2}$/.test(r.due))throw new Error('Use a valid date.');}
  if(p.properties!==undefined)r.properties=propertyList(p.properties);
  message=`Updated ${r.title}`;
 }else if(input.type==='createRecord'){
  const r=input.record;if(!r||!['task','idea','opportunity'].includes(r.kind))throw new Error('Choose task, idea or opportunity.');
  const title=clean(r.title,180);if(!title)throw new Error('Add a title.');
  state.records.unshift({...record(crypto.randomUUID(),title,r.kind,propertyList(r.properties),'Created in this preview.'),note:clean(r.note),provenance:'User supplied'});message=`Added ${title}`;
 }else if(input.type==='createDraft'){
  const source=state.records.find(x=>x.id===input.id);if(!source)throw new Error('Source not found.');propertyList([input.destination]);
  const id=`draft-${source.id}-${input.destination}`;if(state.records.some(r=>r.id===id))return state;
  state.records.unshift({...record(id,`${input.destination==='RyanThe1'?'Hub feature':'Content idea'} · ${source.title}`,'idea',propertyList([...new Set([...source.properties,input.destination])]),'Draft only. Review source rights, destination and exact content before any publication.','Planned'),sourceId:source.id,provenance:source.provenance});message=`Created linked draft from ${source.title}`;
 }else throw new Error('Unsupported action.');
 state.activity.unshift({id:crypto.randomUUID(),text:message,at:now});state.activity=state.activity.slice(0,80);return state;
}

