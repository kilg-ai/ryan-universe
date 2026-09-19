import type {Inquiry} from './inquiries.ts';
import type {RecordItem} from './model.ts';
import {heldFor} from './held-work.ts';
import {deskPresentation} from './desk-presentation.ts';
import {ryanDateStatus} from './inquiries.ts';

// Current held work takes priority over a historical sent reply.
export function inquiryAction(i:Inquiry,records:RecordItem[]=[]):string {
 const follow=heldFor(records,i.id,'follow-up')[0]?.packet;
 if(follow?.suppressed)return 'Contact restriction recorded — resolve it before any follow-up.';
 if(follow&&follow.factsRevision!==i.facts_revision)return 'Event details changed — revise the held follow-up before review.';
 if(follow&&follow.state==='held')return follow.owner+': review follow-up v'+follow.version+' below. It has not been sent.';
 if(follow&&follow.state==='reviewed-held')return 'Follow-up v'+follow.version+' reviewed and still held. Confirm the next customer action.';
 return deskPresentation(i,ryanDateStatus(i)).next;
}
