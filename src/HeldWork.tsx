import {useState, type FormEvent} from 'react';
import type {Inquiry} from './lib/inquiries';
import type {RecordItem} from './lib/model';
import {heldFor,heldStatus,type HeldKind,type HeldPacket} from './lib/held-work';
export type HeldSave=(i:Inquiry,kind:HeldKind,input:{owner:string;due:string;body:string;suppressed:boolean;contactReviewed:boolean})=>Promise<boolean>;
export function HeldWork({inquiry,records,available,onSave,onReview}:{inquiry:Inquiry;records:RecordItem[];available:boolean;onSave:HeldSave;onReview:(i:Inquiry,r:RecordItem,p:HeldPacket)=>Promise<boolean>}) {
 const [kind,setKind]=useState<HeldKind>('contract'),[body,setBody]=useState(''),[owner,setOwner]=useState('Ron'),[due,setDue]=useState(''),[suppressed,setSuppressed]=useState(false),[contactChecked,setContactChecked]=useState(false),[busy,setBusy]=useState(false);
 const versions=heldFor(records,inquiry.id,kind),latest=versions[0];
 async function save(e:FormEvent){e.preventDefault();setBusy(true);try{if(await onSave(inquiry,kind,{owner,due,body,suppressed,contactReviewed:contactChecked})){setBody('');setContactChecked(false);}}finally{setBusy(false);}}
 return <details className="held-work"><summary>Contracts and follow-ups — held review</summary>
 <p>Prepare a draft or contract brief for internal review. Nothing here sends, signs, charges or reserves a date.</p>
 {!available&&<p role="status">Shared workspace unavailable. Reconnect before saving review work.</p>}
 <label className="field">Review type<select value={kind} onChange={e=>{setKind(e.target.value as HeldKind);setBody('');setContactChecked(false);}}><option value="contract">Contract draft / brief</option><option value="follow-up">Follow-up draft</option></select></label>
 {latest&&<section aria-label="Latest held version"><h3>Version {latest.packet.version} · {heldStatus(latest.packet,inquiry)}</h3><p>Owner: {latest.packet.owner} · Review date: {latest.packet.due}</p><p>{latest.packet.context}</p><pre className="inbox-source">{latest.packet.body}</pre>
 <button className="button" disabled={!available||busy||latest.packet.state==='reviewed-held'||latest.packet.factsRevision!==inquiry.facts_revision||latest.packet.suppressed} onClick={async()=>{setBusy(true);try{await onReview(inquiry,latest.record,latest.packet);}finally{setBusy(false);}}}>Reviewed — keep held</button>
 <button className="button" disabled={busy} onClick={()=>{setBody(latest.packet.body);setOwner(latest.packet.owner);setDue(latest.packet.due);}}>Revise as new version</button></section>}
 {versions.length>1&&<details><summary>Earlier versions ({versions.length-1})</summary>{versions.slice(1).map(v=><section key={v.record.id}><h4>Version {v.packet.version} · {v.packet.state}</h4><pre className="inbox-source">{v.packet.body}</pre></section>)}</details>}
 <form onSubmit={e=>void save(e)}>
 <label className="field">Review owner<input required maxLength={100} value={owner} onChange={e=>setOwner(e.target.value)}/></label>
 <label className="field">Review date<input required type="date" value={due} onChange={e=>setDue(e.target.value)}/></label>
 <p>{kind==='contract'?'Include proposed scope, hours, fee, retainer, cancellation terms and the approved template reference. Mark missing terms as unresolved; this is not an approved agreement.':'Review the existing conversation, reason for contact and any complaint or contact restriction before drafting.'}</p>
 {kind==='follow-up'&&<><label><input type="checkbox" checked={suppressed} onChange={e=>setSuppressed(e.target.checked)}/> Complaint or contact restriction — stop drafting</label><label><input type="checkbox" checked={contactChecked} onChange={e=>setContactChecked(e.target.checked)}/> I checked the existing conversation and contact restrictions for this draft</label></>}
 <label className="field">{kind==='contract'?'Proposed contract text / brief':'Exact follow-up text'}<textarea required rows={7} maxLength={1000} value={body} onChange={e=>setBody(e.target.value)}/></label>
 <button className="button primary" disabled={!available||busy||(kind==='follow-up'&&(suppressed||!contactChecked))}>Save version {(latest?.packet.version||0)+1} — held for review</button>
 </form></details>;
}
