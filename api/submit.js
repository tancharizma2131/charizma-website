import { sameOrigin, json } from '../server/staff-auth.js';
import { SubmissionError,adminConfig,startSubmission,finishSubmission } from '../server/submissions.js';
import { deliverNotifications } from '../server/notifications.js';
export default async function handler(req,res){
    res.setHeader('Cache-Control','no-store');
    if(req.method==='GET'){
        let enabled=false;try{adminConfig();enabled=!!process.env.RESEND_ALERTS_KEY&&!!process.env.APP_ORIGIN;}catch{}
        return json(res,200,{enabled});
    }
    if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return json(res,405,{error:'Method not allowed.'});}
    if(!sameOrigin(req)||!req.headers['content-type']?.startsWith('application/json'))return json(res,403,{error:'Please use the application form on this website.'});
    try{
        adminConfig();
        if(!process.env.RESEND_ALERTS_KEY||!process.env.APP_ORIGIN)throw new SubmissionError('Applications are being connected. Please email info@charizma-mgmt.com for assistance.',503);
        let body=req.body;
        if(typeof body==='string'){if(Buffer.byteLength(body)>12000)return json(res,413,{error:'Request too large.'});try{body=JSON.parse(body);}catch{throw new SubmissionError('Invalid request.');}}
        if(!body||typeof body!=='object'||Array.isArray(body)||Buffer.byteLength(JSON.stringify(body))>12000)throw new SubmissionError('Invalid request.');
        if(body.action==='start')return json(res,200,await startSubmission(req,body));
        if(body.action==='finish'){
            const result=await finishSubmission(body);
            // The durable outbox is committed with the application. An email failure
            // never converts a saved application into a failed submission.
            await deliverNotifications(1,result.reference).catch(()=>{});
            return json(res,200,{ok:true,...result});
        }
        throw new SubmissionError('Invalid request.');
    }catch(error){return json(res,error instanceof SubmissionError?error.status:503,{error:error instanceof SubmissionError?error.message:'We couldn’t confirm your submission. Please try again without refreshing the page.'});}
}
