// Fictional records and in-memory changes only. No real applicant data or requests.
document.addEventListener('DOMContentLoaded', () => {
    const statuses = ['New', 'Reviewing', 'Contacted', 'Archived'];
    const photoLabels = ['Headshot', 'Half body', 'Angled view', 'Full body'];
    const model = (name, gender = 'women') => ({ name: name[0].toUpperCase() + name.slice(1), path: `image/models/${gender}/${name}/Digitals/` });
    const samples = [
        { id: 'C-006', name: 'Alex Example', location: 'Bangkok, Thailand', dob: '2004-04-18', email: 'alex@example.com', instagram: '@alex.example', height: 175, bust: 82, waist: 60, hips: 90, tattoos: 'No', piercings: 'Yes', heard: 'Instagram', portfolio: false, source: 'Website', status: 'New', submitted: '2026-10-27T11:20:00Z', reference: model('ksenia'), notes: [] },
        { id: 'C-005', name: 'Mila Demo', location: 'Warsaw, Poland', dob: '2003-08-12', email: 'mila@example.com', instagram: '@mila.example', height: 178, bust: 83, waist: 59, hips: 90, tattoos: 'Yes', piercings: 'No', heard: 'A friend', portfolio: true, source: 'Website', status: 'Reviewing', submitted: '2026-10-27T06:45:00Z', reference: model('polly'), notes: [{ text: 'Example note: discuss availability for an introductory call.', at: '2026-10-27T08:00:00Z', author: 'Team (sample)' }], reviewed: '2026-10-27T08:00:00Z' },
        { id: 'C-004', name: 'Noah Example', location: 'Berlin, Germany', dob: '2002-02-06', email: 'noah@example.com', instagram: '@noah.example', height: 183, bust: 85, waist: 74, hips: 83, tattoos: 'No', piercings: 'No', heard: 'Agency website', portfolio: true, source: 'Website', status: 'Contacted', submitted: '2026-10-26T09:00:00Z', reference: model('nik', 'men'), notes: [], reviewed: '2026-10-27T02:15:00Z' },
        { id: 'C-003', name: 'Lena Demo', location: 'Prague, Czechia', dob: '2004-11-10', email: 'lena@example.com', instagram: '@lena.example', height: 173, bust: 79, waist: 59, hips: 89, tattoos: 'No', piercings: 'Yes', heard: 'Instagram', portfolio: false, source: 'Website', status: 'New', submitted: '2026-10-25T04:30:00Z', reference: model('uli'), notes: [] },
        { id: 'C-002', name: 'Sasha Example', location: 'Tallinn, Estonia', dob: '2001-06-22', email: 'sasha@example.com', instagram: '@sasha.example', height: 173, bust: 82, waist: 60, hips: 90, tattoos: 'Yes', piercings: 'Yes', heard: 'A model', portfolio: true, source: 'Website', status: 'Archived', submitted: '2026-10-20T05:00:00Z', reference: model('kaia'), notes: [], reviewed: '2026-10-22T07:30:00Z' },
        { id: 'G-001', name: 'Morgan Demo', location: 'London, United Kingdom', dob: '2000-09-02', email: 'morgan@example.com', instagram: '@morgan.example', height: 177, bust: 81, waist: 61, hips: 89, tattoos: 'No', piercings: null, heard: 'Instagram', portfolio: true, source: 'Google Form', status: 'Reviewing', submitted: '2025-04-14T08:10:00Z', reference: null, notes: [], reviewed: '2026-10-26T05:00:00Z' }
    ];
    const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const date = (value, time = false) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', ...(time ? { hour: '2-digit', minute: '2-digit' } : {}), timeZone: 'Asia/Bangkok' }).format(new Date(value));
    const search = document.querySelector('#applicant-search');
    const source = document.querySelector('#source-filter');
    const sort = document.querySelector('#applicant-sort');
    const list = document.querySelector('#applicant-list');
    const review = document.querySelector('#applicant-review');
    const workspace = document.querySelector('#desk-workspace');
    const announcer = document.querySelector('#desk-status');
    const viewer = document.querySelector('#photo-viewer');
    let records;
    let selectedId;
    let statusFilter = 'All';
    let viewerRecord;
    let viewerIndex = 0;
    let viewerTrigger;

    function resetRecords() {
        records = structuredClone(samples).map(record => ({ ...record, draft: '', activity: [
            ...(record.reviewed ? [{ text: `Status changed from New to ${record.status}`, at: record.reviewed, actor: 'Team (sample)' }] : []),
            ...(record.source === 'Google Form' ? [{ text: 'Historical response imported; original submission date retained', at: '2026-10-25T02:00:00Z', actor: 'Import example' }] : []),
            { text: `Application received via ${record.source}`, at: record.submitted, actor: 'Sample record' }
        ] }));
        selectedId = records[0].id;
    }
    resetRecords();
    document.querySelector('#status-filters').innerHTML = ['All', ...statuses].map(status => `<button type="button" class="status-filter" data-status="${status}" aria-pressed="${status === 'All'}">${status}<span></span></button>`).join('');

    function baseResults() {
        const query = search.value.trim().toLowerCase();
        return records.filter(record => (source.value === 'all' || record.source === source.value)
            && (!query || `${record.name} ${record.location} ${record.email}`.toLowerCase().includes(query)));
    }
    function render() {
        const base = baseResults();
        document.querySelectorAll('.status-filter').forEach(button => {
            button.setAttribute('aria-pressed', String(button.dataset.status === statusFilter));
            const count = button.dataset.status === 'All' ? base.length : base.filter(record => record.status === button.dataset.status).length;
            button.querySelector('span').textContent = count;
            button.setAttribute('aria-label', `${button.dataset.status} applications, ${count}`);
        });
        const results = base.filter(record => statusFilter === 'All' || record.status === statusFilter)
            .sort((a, b) => sort.value === 'newest' ? new Date(b.submitted) - new Date(a.submitted) : new Date(a.submitted) - new Date(b.submitted));
        if (!results.some(record => record.id === selectedId)) selectedId = results[0]?.id;
        document.querySelector('#result-count').textContent = `${results.length} ${results.length === 1 ? 'applicant' : 'applicants'}`;
        document.querySelector('#empty-results').hidden = results.length > 0;
        list.innerHTML = results.map(record => `<button type="button" class="applicant-row" data-id="${record.id}" aria-label="Review ${record.name}, ${record.status}" aria-pressed="${record.id === selectedId}">
            ${record.reference ? `<img class="row-photo" src="${record.reference.path}01.webp" alt="">` : '<span class="row-initials" aria-hidden="true">M</span>'}
            <span class="row-info"><span class="row-name">${record.name}</span><span class="row-meta">${record.location} · ${record.height} cm</span><span class="row-date">${date(record.submitted)} · ${record.source}</span><span class="row-status">${record.status}</span></span></button>`).join('');
        review.hidden = !selectedId;
        if (selectedId) renderReview(records.find(record => record.id === selectedId));
        else workspace.classList.remove('review-open');
    }
    function renderReview(record) {
        review.innerHTML = `<button type="button" class="review-back"><span aria-hidden="true">←</span> All applications</button>
            <div class="review-top"><div><p class="review-kicker">${record.id} · ${record.source === 'Google Form' ? 'Historical application example' : 'Website application example'}</p><h2 tabindex="-1">${record.name}</h2><p class="review-subtitle">${record.location}<br>Received ${date(record.submitted, true)} · Bangkok time</p></div>
            <div class="review-status"><label for="review-status-select">Application status</label><select id="review-status-select">${statuses.map(status => `<option${status === record.status ? ' selected' : ''}>${status}</option>`).join('')}</select></div></div>
            <dl class="measurement-list">${[['Height', record.height], ['Bust / chest', record.bust], ['Waist', record.waist], ['Hips', record.hips]].map(([label, value]) => `<div><dt>${label}</dt><dd>${value} <span>cm</span></dd></div>`).join('')}</dl>
            <div class="review-section"><h3>Digitals</h3>${record.reference ? `<p class="reference-note">Reference photos: ${record.reference.name}. These images illustrate the dashboard; this applicant is fictional.</p><div class="review-photos">${photoLabels.map((label, index) => `<button type="button" data-photo="${index}" aria-label="Enlarge ${label.toLowerCase()} reference photo"><img src="${record.reference.path}0${index + 1}.webp" alt="${record.reference.name} ${label.toLowerCase()} reference"><span>${label} ↗</span></button>`).join('')}</div>` : '<div class="legacy-photos">This example shows an older response with a digitals link instead of direct uploads. The original link would be retained during import.<br><strong>No real historical files are connected in this preview.</strong></div>'}</div>
            <dl class="review-contact">
                <div><dt>Email</dt><dd>${record.email}</dd></div><div><dt>Instagram</dt><dd>${record.instagram}</dd></div>
                <div><dt>Date of birth</dt><dd>${date(record.dob)}</dd></div><div><dt>Portfolio</dt><dd>${record.portfolio ? 'Link provided (sample)' : 'Not provided'}</dd></div>
                <div><dt>Tattoos</dt><dd>${record.tattoos}</dd></div><div><dt>Piercings</dt><dd>${record.piercings ?? 'Not asked in original form'}</dd></div>
                <div><dt>How they heard about Charizma</dt><dd>${record.heard}</dd></div>
            </dl>
            <div class="review-two-column"><section class="review-section"><h3>Team notes</h3><form class="note-form"><label for="review-note">Private note · preview only</label><textarea id="review-note" maxlength="2000" required placeholder="What stands out? What should happen next?">${escape(record.draft)}</textarea><button type="submit">Add note</button></form>
            <ul class="note-list">${record.notes.map(note => `<li><p>${escape(note.text)}</p><small>${escape(note.author)} · ${date(note.at, true)}</small></li>`).join('')}</ul>${record.notes.length ? '' : '<p class="no-notes">No notes yet.</p>'}</section>
            <section class="review-section"><h3>History</h3><ol class="activity-list">${record.activity.map(event => `<li><p>${escape(event.text)}</p><small>${escape(event.actor)} · ${date(event.at, true)}</small></li>`).join('')}</ol></section></div>`;
        review.querySelector('.review-back').addEventListener('click', () => {
            workspace.classList.remove('review-open');
            list.querySelector(`[data-id="${selectedId}"]`)?.focus();
        });
        review.querySelector('#review-status-select').addEventListener('change', event => {
            const previous = record.status;
            record.status = event.target.value;
            record.activity.unshift({ text: `Status changed from ${previous} to ${record.status}`, at: new Date().toISOString(), actor: 'You (preview)' });
            announcer.textContent = `${record.name} changed to ${record.status}. Preview only; no message sent.`;
            render();
            review.querySelector('#review-status-select')?.focus({ preventScroll: true });
        });
        const noteInput = review.querySelector('#review-note');
        noteInput.addEventListener('input', () => { record.draft = noteInput.value; noteInput.setCustomValidity(''); });
        review.querySelector('.note-form').addEventListener('submit', event => {
            event.preventDefault();
            const text = noteInput.value.trim();
            if (!text) { noteInput.setCustomValidity('Please write a note first.'); noteInput.reportValidity(); return; }
            const at = new Date().toISOString();
            record.notes.unshift({ text, at, author: 'You (preview)' });
            record.activity.unshift({ text: 'Team note added', at, actor: 'You (preview)' });
            record.draft = '';
            renderReview(record);
            review.querySelector('#review-note').focus({ preventScroll: true });
            announcer.textContent = `Note added to ${record.name} in this preview.`;
        });
        review.querySelectorAll('[data-photo]').forEach(button => button.addEventListener('click', () => {
            viewerRecord = record;
            viewerIndex = Number(button.dataset.photo);
            viewerTrigger = button;
            renderViewer();
            document.body.style.overflow = 'hidden';
            viewer.showModal();
        }));
    }
    function renderViewer() {
        document.querySelector('#viewer-title').textContent = `${viewerRecord.name} · ${photoLabels[viewerIndex]} · ${viewerIndex + 1} of 4`;
        const image = document.querySelector('#viewer-image');
        image.src = `${viewerRecord.reference.path}0${viewerIndex + 1}.webp`;
        image.alt = `${viewerRecord.reference.name}: ${photoLabels[viewerIndex].toLowerCase()} reference photo`;
    }
    document.querySelector('#close-viewer').addEventListener('click', () => viewer.close());
    viewer.addEventListener('close', () => { document.body.style.overflow = ''; viewerTrigger?.focus({ preventScroll: true }); });
    function changePhoto(direction) { viewerIndex = (viewerIndex + direction + 4) % 4; renderViewer(); }
    document.querySelector('#previous-photo').addEventListener('click', () => changePhoto(-1));
    document.querySelector('#next-photo').addEventListener('click', () => changePhoto(1));
    viewer.addEventListener('keydown', event => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); changePhoto(event.key === 'ArrowLeft' ? -1 : 1); }
    });
    list.addEventListener('click', event => {
        const button = event.target.closest('[data-id]');
        if (!button) return;
        selectedId = button.dataset.id;
        render();
        workspace.classList.add('review-open');
        review.querySelector('h2').focus({ preventScroll: true });
        if (matchMedia('(max-width: 760px)').matches) review.scrollIntoView({ block: 'start' });
    });
    document.querySelector('#status-filters').addEventListener('click', event => {
        const button = event.target.closest('[data-status]');
        if (!button) return;
        statusFilter = button.dataset.status;
        render();
    });
    search.addEventListener('input', render);
    source.addEventListener('change', render);
    sort.addEventListener('change', render);
    function clearFilters() { search.value = ''; source.value = 'all'; sort.value = 'newest'; statusFilter = 'All'; render(); }
    document.querySelector('#clear-filters').addEventListener('click', () => { clearFilters(); search.focus(); });
    document.querySelector('#reset-demo').addEventListener('click', () => {
        resetRecords();
        workspace.classList.remove('review-open');
        clearFilters();
        announcer.textContent = 'All sample records restored. Preview changes cleared.';
    });
    render();
});
