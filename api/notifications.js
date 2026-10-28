import { timingSafeEqual,createHash } from 'node:crypto';
import { staffSession,sameOrigin,json } from '../server/staff-auth.js';
import { deliverNotifications,cleanupExpiredSubmissions } from '../server/notifications.js';
function scheduledRequest(req){
    const secret=process.env.CRON_SECRET;if(!secret)return false;
    const a=createHash('sha256').update(req.headers.authorization||'').digest();
    const b=createHash('sha256').update(`Bearer ${secret}`).digest();return timingSafeEqual(a,b);
}
export default async function handler(req,res){
    try{
        if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return json(res,405,{error:'Method not allowed.'});}
        if(req.method==='GET'){
            if(!scheduledRequest(req))return json(res,401,{error:'Unauthorized.'});
        }else{
            if(!sameOrigin(req)||!req.headers['content-type']?.startsWith('application/json'))return json(res,403,{error:'Please use the dashboard on this website.'});
            if(!await staffSession(req,res))return json(res,401,{error:'Please sign in again.'});
        }
        const result=await deliverNotifications(3);
        await cleanupExpiredSubmissions();
        return json(res,200,result);
    }catch{return json(res,503,{error:'Email alerts could not be checked. Please try again.'});}
}
