document.addEventListener('DOMContentLoaded',()=>{
    const form=document.querySelector('#application-form');
    const steps=Array.from(form.querySelectorAll('.apply-step'));
    const progress=Array.from(document.querySelectorAll('.apply-steps li'));
    const next=document.querySelector('#next-step');
    const back=document.querySelector('#previous-step');
    const status=document.querySelector('#submission-feedback');
    const photoError=document.querySelector('#photo-error');
    const photos=new Map();let step=0,busy=false,enabled=false,ticket=null;
    const types=[
        {key:'headshot',name:'Headshot',hint:'Face the camera, shoulders visible.',example:'image/models/women/kaia/Digitals/01.webp'},
        {key:'angle',name:'45° view',hint:'Turn your face about 45° from the camera, as shown.',example:'image/models/women/kaia/Digitals/02.webp'},
        {key:'half',name:'Half body',hint:'From your head to your hips.',example:'image/models/women/kaia/Digitals/03.webp'},
        {key:'full',name:'Full body',hint:'Head to toe, with room around you.',example:'image/models/women/kaia/Digitals/04.webp'}
    ];
    const now=new Date();form.elements.birthDate.max=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    function error(message=''){photoError.textContent=message;photoError.hidden=!message;}
    function move(index){step=index;steps.forEach((el,i)=>{el.hidden=i!==index;el.disabled=i!==index;});progress.forEach((el,i)=>{if(i===index)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});back.hidden=index===0;document.querySelector('#step-count').textContent=`Step ${index+1} of 2`;next.innerHTML=index===1?'Submit application <span aria-hidden="true">→</span>':'Continue <span aria-hidden="true">→</span>';}
    function fields(){return Object.fromEntries(['fullName','birthDate','location','email','instagram','height','bust','waist','hips','tattoos','piercings','portfolio','source'].map(key=>[key,form.elements.namedItem(key).value]));}
    function newTicket(){return {id:crypto.randomUUID(),token:Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join(''),uploaded:new Set()};}
    // Cover response bodies as well as connection setup; abort releases network work.
    async function boundedRequest(url,options,readBody,timeout){
        const controller=new AbortController();let timer;
        const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{
            const error=new Error('The connection took too long. Your details and photos are still here. Please retry without refreshing the page.');
            reject(error);controller.abort();
        },timeout);});
        try{return await Promise.race([(async()=>{
            const response=await fetch(url,{...options,signal:controller.signal});
            const data=readBody?await response.json().catch(()=>({})):null;
            return {response,data};
        })(),deadline]);}finally{clearTimeout(timer);}
    }
    async function api(body){
        const {response,data}=await boundedRequest(body?'/api/submit':`/api/submit?check=${crypto.randomUUID()}`,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})},true,body?(body.action==='finish'?90000:60000):15000);
        if(!response.ok){const e=new Error(data.error||'We couldn’t confirm your submission. Try again without refreshing the page.');e.status=response.status;e.field=data.field;throw e;}return data;
    }
    async function prepareImage(file){
        const url=URL.createObjectURL(file);const image=new Image();image.src=url;
        try{
            await image.decode();const canvas=document.createElement('canvas');const ratio=Math.min(1,2000/image.naturalWidth,2000/image.naturalHeight);canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
            let blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.84));
            if(blob?.size>2*1024*1024)blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.65));
            if(!blob||blob.type!=='image/webp'||blob.size>2*1024*1024)throw new Error('This photo could not be prepared. Please choose a smaller JPG, PNG or WebP image.');
            return blob;
        }finally{URL.revokeObjectURL(url);}
    }
    function renderPhoto(key){
        const card=form.querySelector(`[data-photo="${key}"]`);const photo=types.find(p=>p.key===key);const selected=photos.get(key);
        card.querySelector('img').src=selected?selected.url:photo.example;card.querySelector('img').alt=selected?`Your selected ${photo.name.toLowerCase()}`:`${document.querySelector("#example-model").value === "nik" ? "Nik" : "Kaia"}: ${photo.name.toLowerCase()} example`;
        card.querySelector('.photo-frame').classList.toggle('is-example',!selected);card.querySelector('.photo-frame').classList.toggle('has-photo',!!selected);
        card.querySelector('.photo-action').textContent=selected?'Change photo':'+ Add your photo';card.querySelector('.photo-credit').textContent=selected?'Your selected photo':`Example · ${document.querySelector('#example-model').value === 'nik' ? 'Nik' : 'Kaia'}`;card.querySelector('.photo-remove').hidden=!selected;
    }
    document.querySelector('#digital-uploads').innerHTML=types.map((photo,index)=>`<div class="photo-card" data-photo="${photo.key}"><div class="photo-frame is-example"><img src="${photo.example}" alt="Kaia: ${photo.name.toLowerCase()} example"><span class="photo-action" aria-hidden="true">+ Add your photo</span><input type="file" id="photo-${photo.key}" accept="image/jpeg,image/png,image/webp" aria-label="Add your ${photo.name.toLowerCase()} photo" aria-describedby="hint-${photo.key}"></div><h3><span aria-hidden="true">0${index+1}</span>${photo.name}</h3><p id="hint-${photo.key}">${photo.hint}</p><p class="photo-credit">Example · Kaia</p><button type="button" class="photo-remove" hidden>Remove</button></div>`).join('');
    let preparing=0;
    types.forEach(photo=>{
        const input=document.querySelector(`#photo-${photo.key}`);let version=0;
        input.addEventListener('change',async()=>{
            const file=input.files[0];if(!file)return;const current=++version;
            if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024){input.value='';error('Please choose a JPG, PNG or WebP image up to 10 MB.');return;}
            ++preparing;next.disabled=true;status.textContent='Preparing your photo…';
            try{const blob=await prepareImage(file);if(current!==version)return;const previous=photos.get(photo.key);if(previous)URL.revokeObjectURL(previous.url);photos.set(photo.key,{blob,url:URL.createObjectURL(blob)});ticket=null;renderPhoto(photo.key);error();}
            catch(e){input.value='';error(e.message||'This photo could not be opened. Please choose another image.');}
            finally{--preparing;if(!preparing){next.disabled=!enabled||busy;status.textContent='';}}
        });
        form.querySelector(`[data-photo="${photo.key}"] .photo-remove`).addEventListener('click',()=>{++version;const old=photos.get(photo.key);if(old)URL.revokeObjectURL(old.url);photos.delete(photo.key);input.value='';ticket=null;renderPhoto(photo.key);input.focus();});
    });
    function fieldError(el,message=''){
        el.setCustomValidity(message);
        if(message)el.setAttribute('aria-invalid','true');else el.removeAttribute('aria-invalid');
        const id=`${el.id}-error`;let note=document.getElementById(id);
        if(message&&!note){note=document.createElement('p');note.id=id;note.className='field-error';el.insertAdjacentElement('afterend',note);el.setAttribute('aria-describedby',`${el.getAttribute('aria-describedby')||''} ${id}`.trim());}
        if(note){note.textContent=message;note.hidden=!message;}
    }
    form.addEventListener('input',event=>{if(event.target.type!=='file'){if(event.target.name)ticket=null;fieldError(event.target);}});
    function fieldMessage(el){
        const value=el.value.trim(),key=el.name;
        const labels={fullName:'name',birthDate:'date of birth',location:'city and country',email:'email address',instagram:'Instagram',source:'answer about how you heard of Charizma'};
        if(labels[key]&&(!value||value.length>Number(el.maxLength>0?el.maxLength:200)||/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value)))return `Please check your ${labels[key]}.`;
        if(key==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))return 'Please check your email address.';
        if(key==='birthDate'){
            const dob=new Date(`${value}T00:00:00Z`);
            if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(dob.valueOf())||dob.toISOString().slice(0,10)!==value||dob>new Date()||dob.getUTCFullYear()<1900)return 'Please check your date of birth.';
        }
        if(['height','bust','waist','hips'].includes(key)){
            const n=Number(value);if(!value||!Number.isFinite(n)||n<=0||n>300||!Number.isInteger(n*2))return 'Please enter measurements in centimetres, using whole or half centimetres.';
        }
        if(['tattoos','piercings'].includes(key)&&!['Yes','No'].includes(value))return `Please answer the ${key} question.`;
        if(key==='instagram'&&!/^@?[A-Za-z0-9._]{1,30}$/.test(value)){
            try{const u=new URL(value);if(u.protocol!=='https:'||!['instagram.com','www.instagram.com'].includes(u.hostname)||!/^\/[A-Za-z0-9._]{1,30}\/?$/.test(u.pathname)||u.username||u.password)throw new Error();}catch{return 'Please enter your Instagram username or profile link.';}
        }
        if(key==='portfolio'&&value){try{const u=new URL(value);if(value.length>1000||/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value)||!['https:','http:'].includes(u.protocol)||u.username||u.password)throw new Error();}catch{return 'Please enter a valid portfolio link.';}}
        return '';
    }
    function validate(){
        let first;
        for(const el of steps[step].querySelectorAll('input:not([type="file"]),select,textarea')){
            fieldError(el);const message=fieldMessage(el)||(!el.checkValidity()?el.validationMessage:'');
            fieldError(el,message);if(message&&!first)first=el;
        }
        if(first){first.focus();first.reportValidity();return false;}
        if(step===1&&photos.size!==4){error('Please add your own four digitals before submitting.');document.querySelector(`#photo-${types.find(p=>!photos.has(p.key)).key}`).focus();return false;}error();return true;
    }
    function setBusy(value){busy=value;form.setAttribute('aria-busy',String(value));form.querySelectorAll('input,select,textarea,button').forEach(el=>el.disabled=value);next.disabled=value||!enabled||preparing>0;}
    async function submit(){
        ticket ||= newTicket();const saved=ticket;const values=fields();setBusy(true);
        try{
            status.textContent='Preparing your private uploads…';
            if(!saved.uploads){const started=await api({action:'start',id:saved.id,token:saved.token,fields:values,files:types.map(p=>({kind:p.key,type:photos.get(p.key).blob.type,size:photos.get(p.key).blob.size})),website:form.elements.website.value});if(started.complete){complete(started.reference,values);return;}saved.uploads=started.uploads;}
            for(let i=0;i<saved.uploads.length;i++){
                const upload=saved.uploads[i];if(saved.uploaded.has(upload.kind))continue;
                status.textContent=`Uploading photo ${i+1} of 4…`;
                const blob=photos.get(upload.kind).blob;
                try{
                    const {response,data}=await boundedRequest(upload.url,{method:'PUT',headers:{'Content-Type':blob.type,'cache-control':'max-age=0','x-upsert':'false'},body:blob},true,60000);
                    if(!response.ok&&response.status!==409&&data.error!=='Duplicate'&&String(data.statusCode)!=='409')throw new Error('A photo upload was interrupted. Your photos are still here. Please retry without refreshing the page.');
                }catch(error){
                    // Refresh signed URLs on the next attempt, keeping the same ticket
                    // and skipping photos whose uploads were already confirmed.
                    saved.uploads=null;throw error;
                }
                saved.uploaded.add(upload.kind);
            }
            status.textContent='Saving your application…';const result=await api({action:'finish',id:saved.id,token:saved.token});complete(result.reference,values);
        }catch(e){if(e.status===410)ticket=null;if(e.field){const el=form.elements.namedItem(e.field);if(el){const index=steps.findIndex(s=>s.contains(el));setBusy(false);if(index>=0)move(index);fieldError(el,e.message);el.focus();}}status.textContent=e.message||'We couldn’t confirm your submission. Your details and photos are still here. Please retry without refreshing the page.';if(!e.field)next.textContent='Retry application';}
        finally{setBusy(false);}
    }
    function complete(reference,values){
        document.querySelector('#confirmation-name').textContent=values.fullName;document.querySelector('#application-reference').textContent=`Application reference: ${reference}`;
        document.querySelector('#application-flow').hidden=true;document.querySelector('#application-confirmation').hidden=false;status.textContent='';const title=document.querySelector('#confirmation-title');title.focus({preventScroll:true});title.scrollIntoView({block:'center'});
        for(const item of photos.values())URL.revokeObjectURL(item.url);photos.clear();ticket=null;
    }
    form.addEventListener('submit',event=>{event.preventDefault();if(busy||preparing||!enabled||!validate())return;if(step===0){move(1);steps[1].querySelector('h2').focus({preventScroll:true});document.querySelector('.apply-steps').scrollIntoView({block:'start'});}else submit();});
    back.addEventListener('click',()=>{if(!busy){move(0);steps[0].querySelector('h2').focus();}});
    move(0);
    api().then(data=>{enabled=!!data.enabled;next.disabled=!enabled;document.querySelector('#connection-note').textContent=enabled?'Your application and photos are shared privately with the Charizma team.':'This form is being connected. Please contact the Charizma team using the email link below.';}).catch(()=>{document.querySelector('#connection-note').textContent='This form is temporarily unavailable. Please contact the Charizma team using the email link below.';});
    document.querySelector('#example-model').addEventListener('change', event => {
        const male = event.target.value === 'nik';
        const model = male ? 'Nik' : 'Kaia';
        const base = male ? 'image/models/men/nik/Digitals/' : 'image/models/women/kaia/Digitals/';
        types.forEach(photo => {
            photo.example = base + ({headshot:'01',angle:'02',half:'03',full:'04'}[photo.key]) + '.webp';
            const card = document.querySelector(`[data-photo="${photo.key}"]`);
            if (card?.querySelector('.is-example')) {
                card.querySelector('img').src = photo.example;
                card.querySelector('img').alt = `${model}: ${photo.name.toLowerCase()} example`;
            }
            renderPhoto(photo.key);
        });
    });
});
