export const bookingAccount = 'ryank.the1@gmail.com';
export const propertyKeys = ['RyanThe1','YouTube','GSB','19U','SupportYouthDJs','HipHopColoringPages'] as const;
export type Facts = {title:string;contact_name:string;contact_email:string;venue:string;local_date:string;local_start:string;local_end_date:string;local_end:string;event_timezone:string;timezone_source:string;timezone_confirmed:boolean;start_utc:string|null;end_utc:string|null;notes:string};
export type Calendar = {id:string;facts_revision:number;current:boolean;fresh:boolean;outcome:string;evidence:{checked_at:string;method:string;calendars:{account_id:string;calendar_id:string;calendar_timezone?:string;response_timezone?:string;window_start_utc:string;window_end_utc:string;query_complete:boolean;busy_intervals:{start_utc:string;end_utc:string}[];evidence_ref:string}[];note?:string}};
export type Draft = {id:string;version:number;facts_revision:number;body:string;calendar_check_id:string|null;created_at:string;current:boolean};
export type Inquiry = {id:string;revision:number;facts_revision:number;facts:Facts;property_keys:string[];status:string;source:{provider:string;account_id:string;native_id:string;observed_at:string;source_text?:string;source_url?:string;prior_response?:{native_id:string;observed_at:string;note:string}};calendar_checks:Calendar[];reply_drafts:Draft[];reply_reviews:{draft_id:string;decision:string;created_at:string}[]};
export const blankFacts:Facts = {title:'',contact_name:'',contact_email:'',venue:'',local_date:'',local_start:'',local_end_date:'',local_end:'',event_timezone:'',timezone_source:'',timezone_confirmed:false,start_utc:null,end_utc:null,notes:''};
const text=(v:unknown,max=2000)=>{if(typeof v!=='string'||v.length>max)throw new Error('Invalid or oversized text.');return v.trim();};
const validDate=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
export function instant(v:unknown){
 const s=text(v,40),m=s.match(/^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(\.\d{1,3})?)?(Z|([+-])(\d{2}):(\d{2}))$/);
 if(!m||!validDate(m[1])||(m[6]!=='Z'&&(Number(m[8])>14||Number(m[9])>59||(Number(m[8])===14&&Number(m[9])!==0)))||!Number.isFinite(Date.parse(s)))throw new Error('Use a real date and time with an explicit UTC offset.');
 return s;
}
function representation(n:number,zone:string){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(n);
 const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
 return p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute;
}
export function resolveLocal(date:string,time:string,zone:string):number|null{
 if(!validDate(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||!zone)return null;
 const wanted=date+'T'+time,naive=Date.parse(wanted+':00Z'),offsets=new Set<number>();
 try {
  for(let h=-48;h<=48;h+=3){const n=naive+h*3600000;offsets.add(Date.parse(representation(n,zone)+':00Z')-n);}
  const candidates=[...offsets].map(offset=>naive-offset).filter(n=>representation(n,zone)===wanted);
  return candidates.length===1?candidates[0]:null;
 }catch{return null;}
}
export function validateFacts(value:unknown):Facts{
 if(!value||typeof value!=='object')throw new Error('Event details are required.');
 const input=value as Record<string,unknown>,f={...blankFacts};
 for(const key of Object.keys(blankFacts) as (keyof Facts)[]){
  if(key==='timezone_confirmed')continue;if(key==='start_utc'||key==='end_utc')continue;
  const s=text(input[key]??'',key==='notes'?8000:300);if(key!=='notes'&&/[\r\n]/.test(s))throw new Error('Use a single line for '+key);(f as unknown as Record<string,unknown>)[key]=s;
 }
 if(!f.title||f.title.length>180)throw new Error('A short inquiry title is required.');
 if(f.contact_email&&!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(f.contact_email))throw new Error('Enter a valid reply email.');
 for(const key of ['local_date','local_end_date'] as const)if(f[key]&&!validDate(f[key]))throw new Error('Enter a valid event date.');
 for(const key of ['local_start','local_end'] as const)if(f[key]&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(f[key]))throw new Error('Enter a valid event time.');
 if(f.event_timezone){try{new Intl.DateTimeFormat('en-US',{timeZone:f.event_timezone});}catch{throw new Error('Use an IANA timezone such as America/New_York.');}}
 f.timezone_confirmed=input.timezone_confirmed===true;
 if(f.timezone_confirmed){
  if(!f.timezone_source)throw new Error('Record how this event’s timezone was confirmed.');
  const start=resolveLocal(f.local_date,f.local_start,f.event_timezone),end=resolveLocal(f.local_end_date,f.local_end,f.event_timezone);
  if(start===null||end===null)throw new Error('This local time is missing, invalid or ambiguous during a clock change. Confirm the exact time before continuing.');
  if(end<=start)throw new Error('The event must end after it starts.');
  f.start_utc=new Date(start).toISOString();f.end_utc=new Date(end).toISOString();
 }
 return f;
}
export function parseFormspree(raw:string):Facts{
 const source=text(raw,12000).replace(/\r\n/g,'\n'),keys=['source','name','email','phone','eventDate','startTime','location','eventType','eventLength','guestCount','notes','budgetRange','venueType','cleanMusic','referralSource','organizationName','invoicingNeeds','bestContactMethod'];
 const matches=[...source.matchAll(new RegExp('^('+keys.join('|')+'):[ \\t]*$','gm'))],fields:Record<string,string>={};
 for(let i=0;i<matches.length;i++){
  const m=matches[i];if(Object.hasOwn(fields,m[1]))throw new Error('Repeated form labels need manual review; no fields were imported.');
  const footer=source.indexOf('\nSubmitted',m.index),end=matches[i+1]?.index??(footer>=0?footer:source.length);
  fields[m[1]]=source.slice(m.index!+m[0].length,end).trim().replace(/&#39;/g,"'").replace(/&amp;/g,'&');
 }
 const f={...blankFacts,title:(fields.name||'New')+' booking inquiry',contact_name:fields.name||'',contact_email:fields.email||'',local_date:fields.eventDate||'',local_start:fields.startTime||'',venue:fields.location||'',notes:['Event: '+(fields.eventType||'Unknown'),'Guests: '+(fields.guestCount||'Unknown'),'Budget: '+(fields.budgetRange||'Not supplied'),'Venue type: '+(fields.venueType||'Unknown'),'Clean music: '+(fields.cleanMusic||'Not supplied'),fields.notes||''].join('\n')};
 const hours=Number(fields.eventLength?.match(/^(\d+(?:\.\d+)?)\s*hours?$/i)?.[1]||0);
 if(validDate(f.local_date)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(f.local_start)&&hours>0&&hours<=24){
  const end=new Date(Date.parse(f.local_date+'T'+f.local_start+':00Z')+hours*3600000).toISOString();f.local_end_date=end.slice(0,10);f.local_end=end.slice(11,16);
 }
 return validateFacts(f);
}
export async function digest(s:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');}
export function propertyList(value:unknown):string[]{
 if(!Array.isArray(value)||value.length>6||value.some(p=>typeof p!=='string'||!(propertyKeys as readonly string[]).includes(p)))throw new Error('Choose only named Universe properties.');
 return [...new Set(value as string[])];
}
export function ryanDateStatus(i:Inquiry):'booked'|'not booked'|'not checked'{
 const c=i.calendar_checks.find(x=>x.current)||i.calendar_checks[0];
 if(!c)return 'not checked';
 return c.evidence.calendars.some(cal=>(cal.busy_intervals||[]).length>0)?'booked':'not booked';
}
export function calendarLabel(i:Inquiry,now=Date.now()){
 const c=i.calendar_checks[0];if(!c)return 'Not checked';
 if(c.facts_revision!==i.facts_revision)return 'Event changed — recheck';
 const age=now-Date.parse(c.evidence.checked_at);if(!Number.isFinite(age)||age< -60000||age>600000)return 'Stale — recheck';
 if(!i.facts.timezone_confirmed)return 'Confirm event timezone';
 const s=Date.parse(i.facts.start_utc||''),e=Date.parse(i.facts.end_utc||'');
 if(!Number.isFinite(s)||!Number.isFinite(e)||!c.evidence.calendars.length||c.evidence.calendars.some(x=>!x.query_complete||Date.parse(x.window_start_utc)>s||Date.parse(x.window_end_utc)<e))return 'Coverage incomplete';
 return c.outcome==='busy'?'Conflict recorded':c.outcome==='clear_in_queried_calendars'?'No conflict in queried calendars':'Check incomplete';
}
export function draftStale(i:Inquiry,d=i.reply_drafts[0],now=Date.now()){
 if(!d)return false;if(d.facts_revision!==i.facts_revision)return true;
 if(!d.calendar_check_id)return false;
 return d.calendar_check_id!==i.calendar_checks[0]?.id||!['No conflict in queried calendars','Conflict recorded'].includes(calendarLabel(i,now));
}
export function makeReply(i:Inquiry){
 if(i.source.prior_response)throw new Error('A previous reply is recorded. Review that conversation before drafting another.');
 const f=i.facts,date=f.local_date?new Intl.DateTimeFormat('en-US',{dateStyle:'long',timeZone:'UTC'}).format(new Date(f.local_date+'T12:00:00Z')):'your event';
 const questions=['the exact venue address, load-in arrangements and event contact','whether sound/PA equipment will be provided or is needed'];
 if(!f.timezone_confirmed||!f.local_start||!f.local_end)questions.push('the start and end time, including the timezone');
 if(/Budget: (Not supplied|Unknown)/i.test(f.notes))questions.push('the budget you have in mind');
 if(/outdoor|festival/i.test(f.notes))questions.push('access to power, a covered DJ area and the weather backup plan');
 const clean=/^Clean music:[ \t]*(yes|true|required)[ \t]*$/im.test(f.notes);
 return 'Hi '+(f.contact_name.split(/\s+/)[0]||'there')+',\n\nThank you for reaching out about '+date+(f.venue?' at '+f.venue:'')+'. We have your inquiry and are reviewing the schedule and event details.\n\nCould you confirm:\n'+questions.map(q=>'• '+q).join('\n')+'\n\n'+(clean?'We have noted your clean-music requirement. ':'')+'Once we have these details and finish the availability review, we can discuss the next steps. This message does not reserve or confirm the date.\n\nThank you,\nRon\nFor Ryan the 1';
}

