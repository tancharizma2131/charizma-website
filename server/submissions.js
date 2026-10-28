import { createHash, createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import sharp from 'sharp';
import { config } from './staff-auth.js';
export const KINDS=['headshot','angle','half','full'];
export const MAX_UPLOAD=2*1024*1024;
export class SubmissionError extends Error {
    constructor(message,status=400){super(message);this.status=status;}
}
export function adminConfig(){
    const {url}=config();const key=process.env.SUPABASE_SECRET_KEY;
    if(!key||process.env.APPLICATIONS_ENABLED!=='true')throw new SubmissionError('Applications are being connected. Please email info@charizma-mgmt.com for assistance.',503);
    return {url,key};
}
export async function adminRequest(path,{method='GET',body,headers={},raw=false}={}){
    const {url,key}=adminConfig();
    const response=await fetch(`${url}${path}`,{method,headers:{apikey:key,...(!raw?{'Content-Type':'application/json'}:{}),...headers},...(body!==undefined?{body:raw?body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
    if(raw)return response;
    const data=await response.json().catch(()=>null);
    if(!response.ok){
        const msg=String(data?.message||'');
        if(msg.includes('RATE_LIMITED'))throw new SubmissionError('Too many attempts. Please try again later or contact info@charizma-mgmt.com.',429);
        if(msg.includes('STORAGE_FULL'))throw new SubmissionError('Applications are temporarily unavailable. Please contact info@charizma-mgmt.com.',503);
        if(msg.includes('EXPIRED_TICKET'))throw new SubmissionError('This upload session has expired. Please reload the page and try again.',410);
        throw new SubmissionError('We couldn’t finish this request. Please try again.',503);
    }
    return data;
}
export const tokenHash=token=>createHash('sha256').update(token).digest('hex');
export function privateHash(value){return createHmac('sha256',adminConfig().key).update(`charizma-applications:${value}`).digest('hex');}
export function clientIP(req){
    const ip=process.env.VERCEL?String(req.headers['x-vercel-forwarded-for']||'').split(',')[0].trim():req.socket?.remoteAddress;
    if(!ip||!isIP(ip))throw new SubmissionError('We couldn’t verify this request. Please try again.',400);
    return ip;
}
function text(value,name,max=200){
    if(typeof value!=='string'||!value.trim()||value.trim().length>max||/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value))throw new SubmissionError(`Please check your ${name}.`);
    return value.trim();
}
export function validateApplication(input,files,now=new Date()){
    if(!input||typeof input!=='object'||Array.isArray(input))throw new SubmissionError('Please check your application details.');
    const data={fullName:text(input.fullName,'name'),birthDate:text(input.birthDate,'date of birth',10),location:text(input.location,'city and country'),email:text(input.email,'email address',254).toLowerCase(),instagram:text(input.instagram,'Instagram'),source:text(input.source,'answer about how you heard of Charizma',500)};
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))throw new SubmissionError('Please check your email address.');
    const dob=new Date(`${data.birthDate}T00:00:00Z`);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(data.birthDate)||Number.isNaN(dob.valueOf())||dob.toISOString().slice(0,10)!==data.birthDate||dob>now||dob.getUTCFullYear()<1900)throw new SubmissionError('Please check your date of birth.');
    for(const key of ['height','bust','waist','hips']){
        if(!['string','number'].includes(typeof input[key])||String(input[key]).trim()==='')throw new SubmissionError('Please check your measurements.');
        const value=Number(input[key]);if(!Number.isFinite(value)||value<=0||value>300||!Number.isInteger(value*2))throw new SubmissionError('Please enter measurements in centimetres, using whole or half centimetres.');data[key]=value;
    }
    for(const key of ['tattoos','piercings']){if(!['Yes','No',true,false].includes(input[key]))throw new SubmissionError(`Please answer the ${key} question.`);data[key]=input[key]===true||input[key]==='Yes';}
    if(!/^@?[A-Za-z0-9._]{1,30}$/.test(data.instagram)){
        try{const u=new URL(data.instagram);if(u.protocol!=='https:'||!['instagram.com','www.instagram.com'].includes(u.hostname)||!/^\/[A-Za-z0-9._]{1,30}\/?$/.test(u.pathname)||u.username||u.password)throw new Error();}catch{throw new SubmissionError('Please enter your Instagram username or profile link.');}
    }
    data.portfolio='';if(input.portfolio){const value=text(input.portfolio,'portfolio link',1000);try{const u=new URL(value);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw new Error();data.portfolio=u.href;}catch{throw new SubmissionError('Please enter a valid portfolio link.');}}
    if(!Array.isArray(files)||files.length!==4||new Set(files.map(f=>f?.kind)).size!==4)throw new SubmissionError('Please add all four digitals.');
    const manifest=KINDS.map(kind=>{const f=files.find(f=>f?.kind===kind);if(!f||!['image/webp','image/jpeg','image/png'].includes(f.type)||!Number.isInteger(f.size)||f.size<=0||f.size>MAX_UPLOAD)throw new SubmissionError('Please choose four valid photos. Each prepared photo must be under 2 MB.');return {kind,type:f.type,size:f.size};});
    return {data,manifest};
}
export function validTicket(body){return typeof body?.id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id)&&typeof body?.token==='string'&&/^[0-9a-f]{64}$/.test(body.token);}
const extension=type=>({'image/webp':'webp','image/jpeg':'jpg','image/png':'png'}[type]);
export const pendingPath=(id,file)=>`pending/${id}/${file.kind}.${extension(file.type)}`;
export async function startSubmission(req,body){
    const {data,manifest}=validateApplication(body.fields,body.files);
    if(!validTicket(body)||body.website)throw new SubmissionError('Please check your application and try again.');
    const started=await adminRequest('/rest/v1/rpc/start_application_submission',{method:'POST',body:{p_id:body.id,p_token_hash:tokenHash(body.token),p_ip_hash:privateHash(clientIP(req)),p_email_hash:privateHash(data.email),p_payload:data,p_manifest:manifest}});
    const ticket=Array.isArray(started)?started[0]:started;
    if(!ticket)throw new SubmissionError('Upload session could not be created.',503);
    if(ticket.completed_at)return {complete:true,reference:ticket.application_id};
    const {url}=adminConfig();const uploads=[];
    for(const file of manifest){
        const path=pendingPath(body.id,file);
        const signed=await adminRequest(`/storage/v1/object/upload/sign/application-uploads/${path}`,{method:'POST',body:{}});
        const signedURL=new URL(`${url}/storage/v1${signed.url}`);
        if(signedURL.origin!==url)throw new SubmissionError('Upload is temporarily unavailable.',503);
        uploads.push({kind:file.kind,url:signedURL.href});
    }
    return {uploads,complete:false};
}
export async function normalizePhoto(buffer,type){
    if(buffer.length===0||buffer.length>MAX_UPLOAD)throw new SubmissionError('A photo is too large. Please choose a smaller image.');
    try{
        const image=sharp(buffer,{limitInputPixels:25000000,failOn:'warning',animated:false});
        const metadata=await image.metadata();
        if(!['jpeg','png','webp'].includes(metadata.format)||`image/${metadata.format}`!==type||(metadata.pages||1)>1||!metadata.width||!metadata.height)throw new Error();
        const output=await image.rotate().resize({width:2000,height:2000,fit:'inside',withoutEnlargement:true}).webp({quality:84}).toBuffer();
        if(output.length>MAX_UPLOAD)throw new Error();
        return output;
    }catch{throw new SubmissionError('A photo could not be processed. Please choose a different JPG, PNG or WebP image.');}
}
async function boundedImage(response){
    if(!response.ok)throw new SubmissionError('A photo hasn’t finished uploading. Please try again.');
    if(Number(response.headers.get('content-length'))>MAX_UPLOAD)throw new SubmissionError('A photo is too large.');
    const chunks=[];let bytes=0;
    for await(const chunk of response.body){bytes+=chunk.length;if(bytes>MAX_UPLOAD){await response.body.cancel?.().catch(()=>{});throw new SubmissionError('A photo is too large.');}chunks.push(chunk);}
    return Buffer.concat(chunks);
}
export async function finishSubmission(body){
    if(!validTicket(body))throw new SubmissionError('Please check your application and try again.');
    const found=await adminRequest(`/rest/v1/application_submissions?${new URLSearchParams({id:`eq.${body.id}`,token_hash:`eq.${tokenHash(body.token)}`,select:'id,manifest,completed_at,application_id,expires_at'})}`);
    const ticket=found[0];if(!ticket)throw new SubmissionError('Upload session not found. Please reload and try again.',404);
    if(ticket.completed_at)return {reference:ticket.application_id};
    if(new Date(ticket.expires_at)<new Date())throw new SubmissionError('This upload session has expired. Please reload and try again.',410);
    const photos=[];
    for(const file of ticket.manifest){
        const original=await boundedImage(await adminRequest(`/storage/v1/object/authenticated/application-uploads/${pendingPath(body.id,file)}`,{raw:true}));
        if(original.length!==file.size)throw new SubmissionError('An uploaded photo did not match its expected size. Please try again.');
        const normalized=await normalizePhoto(original,file.type);const path=`applications/${body.id}/${file.kind}.webp`;
        const stored=await adminRequest(`/storage/v1/object/application-digitals/${path}`,{method:'POST',body:normalized,raw:true,headers:{'Content-Type':'image/webp','x-upsert':'true'}});
        if(!stored.ok)throw new SubmissionError('A photo could not be saved. Please try again.',503);
        photos.push({kind:file.kind,path,size:normalized.length});
    }
    const id=await adminRequest('/rest/v1/rpc/complete_application_submission',{method:'POST',body:{p_id:body.id,p_token_hash:tokenHash(body.token),p_photos:photos}});
    // Removing temporary originals is best-effort; maintenance also removes expired tickets.
    await adminRequest('/storage/v1/object/application-uploads',{method:'DELETE',body:{prefixes:ticket.manifest.map(f=>pendingPath(body.id,f))}}).catch(()=>{});
    return {reference:id};
}
