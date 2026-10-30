document.addEventListener('DOMContentLoaded', () => {
    async function boundedRequest(url, options = {}) {
        const controller = new AbortController();
        let timer;
        const timeout = new Promise((_, reject) => {
            timer = setTimeout(() => {
                reject(new Error('The connection took too long. Please try again.'));
                controller.abort();
            }, 20000);
        });
        try {
            return await Promise.race([timeout, (async () => {
                const response = await fetch(url, { ...options, signal: controller.signal });
                const data = await response.json().catch(error => {
                    if (controller.signal.aborted) throw error;
                    return {};
                });
                return { response, data };
            })()]);
        } finally { clearTimeout(timer); }
    }

    const $ = selector => document.querySelector(selector);
    const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const date = (value, withTime = false) => {
        if (!value) return 'Not provided';
        const parsed = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
        return Number.isNaN(parsed.valueOf()) ? 'Not provided' : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}), timeZone: 'Asia/Bangkok' }).format(parsed);
    };
    const statuses = ['New', 'Reviewing', 'Contacted', 'Archived'];
    const kinds = { headshot: 'Headshot', angle: '45° view', half: 'Half body', full: 'Full body' };
    let records = [], selectedId, selectedRecord, page = 0, total = 0, statusFilter = 'All';
    let listVersion = 0, detailVersion = 0, photoVersion = 0, pendingWrite = false, signedOut = false;
    const drafts = new Map();
    const viewer = $('#photo-viewer');
    let viewerIndex = 0, viewerPhotos = [], viewerTrigger;

    function clearPrivateUI() {
        signedOut = true;
        records = []; selectedRecord = null; drafts.clear();
        $('#applicant-list').replaceChildren(); $('#applicant-review').replaceChildren();
        $('#desk-content').hidden = true;
        if (viewer.open) viewer.close();
        $('#viewer-image').removeAttribute('src');
    }
    async function request(params = {}, body) {
        const { response, data } = await boundedRequest(`/api/applicants?${new URLSearchParams({ ...params, _request: crypto.randomUUID() })}`, {
            method: body ? 'POST' : 'GET', cache: 'no-store', credentials: 'same-origin',
            ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {})
        });
        if (response.status === 401) { clearPrivateUI(); location.replace('staff.html'); throw new Error('Please sign in again.'); }
        if (!response.ok) throw new Error(data.error || 'We couldn’t connect. Please try again.');
        return data;
    }
    function showError(error) { $('#desk-error').textContent = error.message || 'We couldn’t connect. Please try again.'; }
    function safeLink(value, label) {
        try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? `<a href="${escape(url.href)}" target="_blank" rel="noopener noreferrer">${escape(label)}</a>` : 'Not available'; }
        catch { return 'Not provided'; }
    }
    $('#status-filters').innerHTML = ['All', ...statuses].map(status => `<button class="status-filter" type="button" data-status="${status}" aria-pressed="${status === 'All'}">${status}</button>`).join('');
    function renderList() {
        $('#applicant-list').innerHTML = records.map(record => `<button type="button" class="applicant-row" data-id="${record.id}" aria-pressed="${record.id === selectedId}" aria-label="Review ${escape(record.full_name)}, ${escape(record.status)}"><span class="row-initials" aria-hidden="true">${escape(record.full_name?.[0] || '?')}</span><span class="row-info"><span class="row-name">${escape(record.full_name)}</span><span class="row-meta">${escape(record.location || 'Location not provided')}${record.height ? ` · ${escape(record.height)} cm` : ''}</span><span class="row-date">${date(record.submitted_at)} · ${escape(record.source)}</span><span class="row-status">${escape(record.status)}</span></span></button>`).join('');
        $('#result-count').textContent = `${total} ${total === 1 ? 'applicant' : 'applicants'}`;
        $('#previous-page').disabled = page === 0;
        $('#next-page').disabled = (page + 1) * 25 >= total;
        $('#page-count').textContent = total ? `${page * 25 + 1}–${page * 25 + records.length} of ${total}` : '0 results';
        $('#empty-results').hidden = total !== 0;
        const filtered = $('#applicant-search').value.trim() || statusFilter !== 'All' || $('#source-filter').value !== 'all';
        $('#empty-results h3').textContent = filtered ? 'No matches.' : 'No applications yet.';
        $('#empty-results p').textContent = filtered ? 'Try a different name or filter.' : 'New applications and imported responses will appear here.';
        $('#clear-filters').hidden = !filtered;
    }
    async function loadList(targetPage = 0) {
        const version = ++listVersion;
        $('#desk-error').textContent = '';
        $('#refresh-records').disabled = true;
        $('#previous-page').disabled = true; $('#next-page').disabled = true;
        const nextPage = targetPage;
        try {
            const result = await request({ status: statusFilter, source: $('#source-filter').value, sort: $('#applicant-sort').value, search: $('#applicant-search').value.trim(), page: String(nextPage) });
            if (version !== listVersion || signedOut) return;
            page = nextPage; total = result.total;
            records = result.records;
            $('#applicant-list').scrollTop = 0;
            $('#desk-content').hidden = false;
            $('#refresh-records').hidden = false;
            $('#retry-alerts').hidden = false;
            $('#desk-connection').textContent = 'Private applicant book · Notes and review changes are saved.';
            if (!records.some(record => record.id === selectedId)) {
                selectedId = records[0]?.id; selectedRecord = null;
                $('#desk-workspace').classList.remove('review-open');
                if (selectedId) loadDetail(selectedId);
                else { ++detailVersion; $('#applicant-review').hidden = true; }
            }
            renderList();
        } catch (error) {
            if (version === listVersion) {
                showError(error);
                $('#desk-connection').textContent = 'Applications could not be refreshed. Please try again.';
                $('#refresh-records').hidden = false;
            }
        } finally {
            if (version === listVersion) { $('#refresh-records').disabled = false; $('#previous-page').disabled = page === 0; $('#next-page').disabled = (page + 1) * 25 >= total; }
        }
    }
    async function loadDetail(id, focus = false) {
        const version = ++detailVersion;
        selectedId = id; selectedRecord = null;
        const panel = $('#applicant-review');
        panel.scrollTop = 0;
        panel.hidden = false; panel.innerHTML = '<p class="reference-note">Loading application…</p>';
        try {
            const record = await request({ id });
            if (version !== detailVersion || selectedId !== id || signedOut) return;
            selectedRecord = record;
            renderDetail(record);
            if (focus) { panel.querySelector('h2').focus({ preventScroll: true }); if (matchMedia('(max-width:760px)').matches) panel.scrollIntoView({ block: 'start' }); }
        } catch (error) { if (version === detailVersion) { panel.textContent = 'This application could not be loaded.'; showError(error); } }
    }
    function eventText(event) {
        if (event.event_type === 'status_changed') return `Status changed from ${event.details?.from || '—'} to ${event.details?.to || '—'}`;
        if (event.event_type === 'note_added') return 'Team note added';
        if (event.event_type === 'imported') return 'Historical response imported; original submission date retained';
        return 'Application received';
    }
    function renderDetail(record) {
        const panel = $('#applicant-review');
        const photos = [...record.photos].sort((a,b) => Object.keys(kinds).indexOf(a.kind) - Object.keys(kinds).indexOf(b.kind));
        const legacy = Array.isArray(record.legacy_photo_urls) ? record.legacy_photo_urls : [];
        const yesNo = value => value === true ? 'Yes' : value === false ? 'No' : 'Not provided';
        panel.innerHTML = `<button type="button" class="review-back"><span aria-hidden="true">←</span> Back to applicants</button><div class="review-top"><div><p class="review-kicker">${escape(record.source)}</p><h2 tabindex="-1">${escape(record.full_name)}</h2><p class="review-subtitle">${escape(record.location || 'Location not provided')}<br>Received ${date(record.submitted_at,true)} · Bangkok time</p></div><div class="review-status"><label for="review-status-select">Application status</label><select id="review-status-select">${statuses.map(status=>`<option${status===record.status?' selected':''}>${status}</option>`).join('')}</select></div></div>
        <dl class="measurement-list">${[['Height',record.height],['Bust / chest',record.bust_chest],['Waist',record.waist],['Hips',record.hips]].map(([label,value])=>`<div><dt>${label}</dt><dd>${value==null?'—':`${escape(value)} <span>cm</span>`}</dd></div>`).join('')}</dl>
        <section class="review-section"><h3>Digitals</h3>${photos.length?`<div class="review-photos">${photos.map(photo=>`<button type="button" data-photo="${photo.id}" aria-label="Enlarge ${escape(kinds[photo.kind]||'digital')}"><img alt="${escape(record.full_name)} · ${escape(kinds[photo.kind]||'Digital')}" hidden><span>${escape(kinds[photo.kind]||'Digital')} ↗</span><span class="photo-error">Loading photo…</span></button>`).join('')}</div>`:'<p class="reference-note">No uploaded digitals are attached to this application.</p>'}${legacy.length?`<ul class="legacy-links">${legacy.map((url,i)=>`<li>${safeLink(url,`Original photo link ${i+1}`)}</li>`).join('')}</ul>`:''}</section>
        <dl class="review-contact">${[['Email',escape(record.email||'Not provided')],['Instagram',escape(record.instagram||'Not provided')],['Date of birth',date(record.birth_date)],['Portfolio',safeLink(record.portfolio_url,'Open portfolio')],['Tattoos',yesNo(record.tattoos)],['Piercings',yesNo(record.piercings)],['How they heard about Charizma',escape(record.heard_about||'Not provided')]].map(([label,value])=>`<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>
        <div class="review-two-column"><section class="review-section"><h3>Team notes</h3><form class="note-form"><label for="review-note">Private team note</label><textarea id="review-note" maxlength="2000" required placeholder="What stands out? What should happen next?">${escape(drafts.get(record.id)||'')}</textarea><button type="submit">Save note</button></form><ul class="note-list">${record.notes.map(note=>`<li><p>${escape(note.body)}</p><small>Charizma team · ${date(note.created_at,true)}</small></li>`).join('')}</ul>${record.notes.length?'':'<p class="no-notes">No notes yet.</p>'}<p class="reference-note">Most recent 100 notes.</p></section><section class="review-section"><h3>Recent history</h3><ol class="activity-list">${record.events.map(event=>`<li><p>${escape(eventText(event))}</p><small>${date(event.occurred_at,true)}</small></li>`).join('')}</ol>${record.events.length?'':'<p class="no-notes">No review changes yet.</p>'}</section></div>`;
        panel.querySelector('.review-back').addEventListener('click',()=>{ $('#desk-workspace').classList.remove('review-open'); $('#applicant-list').querySelector(`[data-id="${record.id}"]`)?.focus(); });
        const select = $('#review-status-select');
        select.addEventListener('change',async()=>{
            const status=select.value;
            if(pendingWrite)return;
            pendingWrite=true; select.disabled=true;
            try { await request({}, { action:'status',id:record.id,status }); record.status=status; const listed=records.find(item=>item.id===record.id); if(listed)listed.status=status; if(statusFilter!=='All'&&statusFilter!==status){selectedId=null;await loadList();}else{renderList();if(selectedId===record.id)await loadDetail(record.id);} $('#desk-status').textContent='Application status saved.'; }
            catch(error){ select.value=record.status; showError(error); }
            finally{ pendingWrite=false; select.disabled=false; }
        });
        const input=$('#review-note');
        input.addEventListener('input',()=>{input.setCustomValidity('');drafts.set(record.id,input.value);});
        panel.querySelector('.note-form').addEventListener('submit',async event=>{
            event.preventDefault(); if(pendingWrite)return;
            const submittedDraft=input.value; const text=submittedDraft.trim(); if(!text){input.setCustomValidity('Please write a note first.');input.reportValidity();return;}
            input.setCustomValidity(''); pendingWrite=true; const button=event.currentTarget.querySelector('button');button.disabled=true;button.textContent='Saving…';input.readOnly=true;
            try{await request({}, {action:'note',id:record.id,text});if(drafts.get(record.id)===submittedDraft)drafts.delete(record.id);if(selectedId===record.id)await loadDetail(record.id);$('#desk-status').textContent='Team note saved.';}
            catch(error){showError({message:`${error.message} Refresh the application before trying to save this note again.`});}
            finally{pendingWrite=false;button.disabled=false;button.textContent='Save note';input.readOnly=false;}
        });
        panel.querySelectorAll('[data-photo]').forEach(button=>{
            const photo=photos.find(item=>item.id===button.dataset.photo);
            request({id:record.id,photo:photo.id}).then(data=>{
                if(!button.isConnected)return;
                const img=button.querySelector('img');img.onload=()=>{img.hidden=false;button.querySelector('.photo-error').hidden=true;};img.onerror=()=>{button.querySelector('.photo-error').textContent='Photo unavailable. Click to retry.';};img.src=data.url;
            }).catch(()=>{if(button.isConnected)button.querySelector('.photo-error').textContent='Photo unavailable. Click to retry.';});
            button.addEventListener('click',()=>{viewerPhotos=photos;viewerIndex=photos.findIndex(item=>item.id===photo.id);viewerTrigger=button;viewer.showModal();document.body.style.overflow='hidden';renderViewer(record.id,record.full_name);});
        });
    }
    async function renderViewer(id=selectedRecord?.id,name=selectedRecord?.full_name){
        const version=++photoVersion;const photo=viewerPhotos[viewerIndex];if(!photo)return;
        $('#viewer-title').textContent=`${name} · ${kinds[photo.kind]||'Digital'} · ${viewerIndex+1} of ${viewerPhotos.length}`;
        const img=$('#viewer-image');img.removeAttribute('src');img.alt='Loading photo…';
        try{const data=await request({id,photo:photo.id});if(version===photoVersion&&viewer.open){img.src=data.url;img.alt=`${name} · ${kinds[photo.kind]||'Digital'}`;}}
        catch(error){if(version===photoVersion){img.alt='Photo could not be loaded. Close and try again.';showError(error);}}
    }
    const changePhoto=direction=>{viewerIndex=(viewerIndex+direction+viewerPhotos.length)%viewerPhotos.length;renderViewer();};
    $('#close-viewer').addEventListener('click',()=>viewer.close());
    viewer.addEventListener('close',()=>{++photoVersion;document.body.style.overflow='';$('#viewer-image').removeAttribute('src');viewerTrigger?.focus();});
    $('#previous-photo').addEventListener('click',()=>changePhoto(-1));$('#next-photo').addEventListener('click',()=>changePhoto(1));
    viewer.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();changePhoto(event.key==='ArrowLeft'?-1:1);}});
    $('#applicant-list').addEventListener('click',event=>{const button=event.target.closest('[data-id]');if(!button||pendingWrite)return;$('#desk-workspace').classList.add('review-open');loadDetail(button.dataset.id,true);selectedId=button.dataset.id;renderList();});
    $('#status-filters').addEventListener('click',event=>{const button=event.target.closest('[data-status]');if(!button||pendingWrite)return;statusFilter=button.dataset.status;$('#status-filters').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b===button));loadList();});
    let searchTimer;$('#applicant-search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>loadList(),300);});
    $('#source-filter').addEventListener('change',()=>loadList());$('#applicant-sort').addEventListener('change',()=>loadList());
    $('#clear-filters').addEventListener('click',()=>{$('#applicant-search').value='';$('#source-filter').value='all';statusFilter='All';$('#status-filters').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.status==='All'));loadList();});
    $('#refresh-records').addEventListener('click',()=>{selectedId=null;loadList();});$('#previous-page').addEventListener('click',()=>{if(!pendingWrite&&page>0)loadList(page-1);});$('#next-page').addEventListener('click',()=>{if(!pendingWrite&&(page+1)*25<total)loadList(page+1);});
    $('#retry-alerts').addEventListener('click',async()=>{
        const button=$('#retry-alerts');button.disabled=true;$('#desk-error').textContent='';
        try{const {response,data:result}=await boundedRequest('/api/notifications',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(!response.ok)throw new Error(result.error||'Email alerts could not be checked.');$('#desk-status').textContent=result.sent?`${result.sent} email alerts sent.`:'Pending alerts checked.';}
        catch(error){showError(error);}finally{button.disabled=false;}
    });
    $('#desk-sign-out').addEventListener('click',async()=>{
        try{const {response}=await boundedRequest('/api/staff',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});if(!response.ok)throw new Error('Couldn’t sign out. Please try again.');clearPrivateUI();location.replace('staff.html');}
        catch(error){showError(error);}
    });
    // On return from browser history, revalidate before showing private records.
    window.addEventListener('pageshow',event=>{if(event.persisted){clearPrivateUI();location.reload();}});
    loadList();
});
