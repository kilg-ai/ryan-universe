import test from 'node:test';
import assert from 'node:assert/strict';
import {deskPresentation,isProofInquiry} from './desk-presentation.ts';
const row={facts_revision:2,reply_drafts:[{id:'d',version:2,current:true,facts_revision:2,body:'Held'}],reply_reviews:[]};
test('outdated draft cannot be reviewed',()=>{assert.equal(deskPresentation({...row,facts_revision:3},'not booked').canReview,false);assert.equal(deskPresentation({...row,reply_drafts:[{...row.reply_drafts[0],current:false}]},'not booked').canReview,false)});
test('latest version wins regardless of array order',()=>{const p=deskPresentation({...row,reply_drafts:[{id:'old',version:1,current:true,facts_revision:2},...row.reply_drafts]},'not checked');assert.equal(p.draft?.id,'d');assert.match(p.next,/refresh/)});
test('review is tied to exact draft and latest decision',()=>{const p=deskPresentation({...row,reply_reviews:[{draft_id:'old',decision:'reviewed',created_at:'2026-09-12'},{draft_id:'d',decision:'needs_changes',created_at:'2026-09-11'}]},'not booked');assert.match(p.reply,/Changes requested/);assert.match(p.next,/revise/)});
test('human response prevents duplicate review and unsupported delivery claims',()=>{const p=deskPresentation({...row,source:{prior_response:{}}},'unknown');assert.equal(p.canReview,false);assert.match(p.next,/existing conversation/);assert.match(p.notification,/unavailable/)});
test('reviewed remains held and busy calendar requires conflict review',()=>{assert.match(deskPresentation({...row,reply_reviews:[{draft_id:'d',decision:'reviewed'}]},'not booked').reply,/remains held/);assert.match(deskPresentation(row,'booked').next,/conflict/)});

test('only explicitly labeled known test inquiries leave the daily queue',()=>{assert.equal(isProofInquiry({facts:{title:'TZ DEFAULT PROOF B booking inquiry',notes:'Not a customer. Do not reply.'}}),true);assert.equal(isProofInquiry({facts:{title:'Customer proof of booking',notes:'Real inquiry'}}),false);assert.equal(isProofInquiry({facts:{title:'RELEASE INTAKE PROOF inquiry',notes:'Customer event'}}),false);});

import {readFileSync,existsSync} from 'node:fs';
test('separately deployed desk presentation copies stay identical',(t)=>{if(!existsSync(new URL('../../../command_center/supabase/functions/booking-intake/desk-presentation.ts',import.meta.url))){t.skip('Edge package is outside this standalone web repository');return;}assert.equal(readFileSync(new URL('./desk-presentation.ts',import.meta.url),'utf8'),readFileSync(new URL('../../../command_center/supabase/functions/booking-intake/desk-presentation.ts',import.meta.url),'utf8'));});
