import { adminRequest, adminConfig, pendingPath } from './submissions.js';
export async function deliverNotifications(limit=3,applicationId=null){
    if(!process.env.RESEND_ALERTS_KEY) return {sent:0,pending:true};
    const dashboard=new URL('/applicants.html',process.env.APP_ORIGIN||'http://127.0.0.1:8052');
    if(process.env.VERCEL&&dashboard.protocol!=='https:')throw new Error('INVALID_ALERT_ORIGIN');
    const jobs=await adminRequest('/rest/v1/rpc/claim_application_notifications',{method:'POST',body:{p_limit:limit,p_application_id:applicationId}});
    let sent=0;
    for(const job of jobs){
        try{
            const response=await fetch('https://api.resend.com/emails',{
                method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_ALERTS_KEY}`,'Content-Type':'application/json','Idempotency-Key':`charizma-application-${job.application_id}`},
                body:JSON.stringify({from:'Charizma Management <applications@notifications.charizma-mgmt.com>',to:['info@charizma-mgmt.com'],subject:'New Charizma application',text:`A new model application is ready to review.\n\nOpen your private applicant book:\n${dashboard.href}\n\nApplication reference: ${job.application_id}\n\nSign in with your staff email to view the details and digitals.`}),signal:AbortSignal.timeout(12000)
            });
            const data=await response.json().catch(()=>({}));
            if(!response.ok||!data.id)throw new Error('DELIVERY_FAILED');
            await adminRequest(`/rest/v1/application_notifications?id=eq.${job.id}`,{method:'PATCH',body:{state:'sent',sent_at:new Date().toISOString(),provider_message_id:data.id,last_error:null,locked_at:null}});
            sent++;
        }catch{
            await adminRequest(`/rest/v1/application_notifications?id=eq.${job.id}`,{method:'PATCH',body:{state:'failed',next_attempt_at:new Date(Date.now()+Math.min(3600000,60000*2**job.attempts)).toISOString(),last_error:'Delivery could not be confirmed; retry scheduled.',locked_at:null}}).catch(()=>{});
        }
    }
    return {sent,pending:jobs.length>sent};
}
export async function cleanupExpiredSubmissions(){
    adminConfig();
    const tickets=await adminRequest(`/rest/v1/application_submissions?${new URLSearchParams({select:'id,manifest,completed_at,expires_at',expires_at:`lt.${new Date().toISOString()}`,cleaned_at:'is.null',order:'expires_at.asc,id.asc',limit:'20'})}`);
    for(const ticket of tickets){
        const paths=ticket.manifest.map(f=>pendingPath(ticket.id,f));
        await adminRequest('/storage/v1/object/application-uploads',{method:'DELETE',body:{prefixes:paths}});
        if(!ticket.completed_at)await adminRequest('/storage/v1/object/application-digitals',{method:'DELETE',body:{prefixes:['headshot','angle','half','full'].map(kind=>`applications/${ticket.id}/${kind}.webp`)}});
        // Keep only the hashed rate-limit record for 48h. Remove private draft answers.
        await adminRequest(`/rest/v1/application_submissions?id=eq.${ticket.id}`,{method:'PATCH',body:{payload:{},manifest:[],cleaned_at:new Date().toISOString()}});
    }
    // Never discard manifests for backlog tickets or failed storage deletions.
    await adminRequest(`/rest/v1/application_submissions?cleaned_at=not.is.null&created_at=lt.${encodeURIComponent(new Date(Date.now()-172800000).toISOString())}`,{method:'DELETE'});
}
