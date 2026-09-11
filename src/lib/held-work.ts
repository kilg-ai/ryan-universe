import {digest, type Inquiry} from './inquiries.ts';
import type {RecordItem} from './model.ts';
export type HeldKind='contract'|'follow-up';
export type HeldPacket={schema:'r1-held-v1';inquiry:string;factsRevision:number;kind:HeldKind;version:number;owner:string;due:string;body:string;state:'held'|'reviewed-held';suppressed:boolean;contactReviewed:boolean;context:string};
export function readHeld(record:RecordItem):HeldPacket|null {
 try {const p=JSON.parse(record.note);return p.schema==='r1-held-v1'&&typeof p.inquiry==='string'&&['contract','follow-up'].includes(p.kind)&&Number.isInteger(p.version)&&p.version>0&&Number.isInteger(p.factsRevision)&&typeof p.body==='string'&&typeof p.owner==='string'&&typeof p.due==='string'&&typeof p.suppressed==='boolean'&&['held','reviewed-held'].includes(p.state)?p:null;}catch{return null;}
}
export function heldFor(records:RecordItem[],id:string,kind:HeldKind){return records.map(record=>({record,packet:readHeld(record)})).filter((x):x is {record:RecordItem;packet:HeldPacket}=>!!x.packet&&x.packet.inquiry===id&&x.packet.kind===kind).sort((a,b)=>b.packet.version-a.packet.version);}
export function makeHeld(i:Inquiry,kind:HeldKind,version:number,input:{owner:string;due:string;body:string;suppressed:boolean;contactReviewed:boolean}):HeldPacket {
 if(!input.owner.trim()||input.owner.length>100)throw new Error('Name the review owner.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(input.due)||!Number.isFinite(Date.parse(input.due+'T12:00:00Z'))||new Date(input.due+'T12:00:00Z').toISOString().slice(0,10)!==input.due)throw new Error('Choose a valid review date.');
 if(!input.body.trim()||input.body.length>1000)throw new Error('Enter draft text or a concise contract brief (up to 1,000 characters).');
 if(kind==='follow-up'&&!input.contactReviewed)throw new Error('Review the existing conversation and contact restrictions first.');
 if(kind==='follow-up'&&input.suppressed)throw new Error('Follow-up drafting is suppressed. Resolve the complaint or contact restriction separately.');
 const p:HeldPacket={schema:'r1-held-v1',inquiry:i.id,factsRevision:i.facts_revision,kind,version,owner:input.owner.trim(),due:input.due,body:input.body.trim(),state:'held',suppressed:kind==='follow-up'&&input.suppressed,contactReviewed:kind==='follow-up'&&input.contactReviewed,context:[i.facts.title,i.facts.local_date,i.facts.local_start,i.facts.local_end,i.facts.event_timezone,i.facts.venue].filter(Boolean).join(' · ').slice(0,300)};
 if(JSON.stringify(p).length>2000)throw new Error('Shorten the draft to fit the shared record.');return p;
}
export function heldStatus(p:HeldPacket,i:Inquiry,today=new Date().toISOString().slice(0,10)){
 if(p.suppressed&&p.kind==='follow-up')return 'Suppressed — do not prepare outreach';
 if(p.factsRevision!==i.facts_revision)return 'Event details changed — save a new version for review';
 return (p.state==='reviewed-held'?'Reviewed — still held':'Needs review — held')+(p.due<today?' · overdue':p.due===today?' · due today':' · review '+p.due);
}
export function reviewHeld(p:HeldPacket,i:Inquiry):HeldPacket {if(p.factsRevision!==i.facts_revision)throw new Error('Event details changed. Save a new version before review.');if(p.suppressed)throw new Error('Suppressed follow-up cannot be reviewed.');return {...p,state:'reviewed-held'};}
export async function heldPayload(p:HeldPacket) {
 const note=JSON.stringify(p);return {kind:'task',title:(p.kind==='contract'?'Contract':'Follow-up')+' review · v'+p.version+' · '+p.context.slice(0,100),status:'needs_review',provenance:'user_supplied',detail:'Held for internal review. Not sent, signed, paid or reserved. Inquiry '+p.inquiry,owner:p.owner,due:p.due,note,property_keys:['RyanThe1'],import_native_id:'held:'+p.inquiry+':'+p.kind+':'+p.version,import_content_digest:await digest(note)};
}
