// Local design preview only: no network submission or persistent storage.
document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('#application-preview-form');
    const steps = Array.from(form.querySelectorAll('.apply-step'));
    const progress = Array.from(document.querySelectorAll('.apply-steps li'));
    const nextButton = document.querySelector('#next-step');
    const backButton = document.querySelector('#previous-step');
    const flow = document.querySelector('#application-flow');
    const confirmation = document.querySelector('#preview-confirmation');
    const photoError = document.querySelector('#photo-error');
    const status = document.querySelector('#preview-feedback');
    const photoData = new Map();
    let currentStep = 0;
    const photoTypes = [
        { key: 'headshot', name: 'Headshot', hint: 'Face the camera, shoulders visible.', example: 'image/models/women/ksenia/Digitals/01.webp' },
        { key: 'angle', name: '45° view', hint: 'Turn slightly to one side.', example: 'image/models/women/ksenia/Digitals/04.webp' },
        { key: 'half', name: 'Half body', hint: 'From your head to your hips.', example: 'image/models/women/ksenia/Digitals/02.webp' },
        { key: 'full', name: 'Full body', hint: 'Head to toe, with room around you.', example: 'image/models/women/ksenia/Digitals/04.webp' }
    ];
    const today = new Date();
    document.querySelector('#birth-date').max = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    function moveStep(index, focus = true) {
        currentStep = index;
        steps.forEach((step, i) => { step.hidden = i !== index; step.disabled = i !== index; });
        progress.forEach((item, i) => {
            if (i === index) item.setAttribute('aria-current', 'step');
            else item.removeAttribute('aria-current');
        });
        backButton.hidden = index === 0;
        document.querySelector('#step-count').textContent = `Step ${index + 1} of ${steps.length}`;
        nextButton.innerHTML = index === steps.length - 1 ? 'Finish preview <span aria-hidden="true">→</span>' : 'Continue <span aria-hidden="true">→</span>';
        if (focus) {
            const heading = steps[index].querySelector('h2');
            heading.focus({ preventScroll: true });
            document.querySelector('.apply-steps').scrollIntoView({ block: 'start' });
        }
    }

    function clearPhoto(key) {
        const existing = photoData.get(key);
        if (existing?.url.startsWith('blob:')) URL.revokeObjectURL(existing.url);
        photoData.delete(key);
    }

    function renderPhoto(key) {
        const card = document.querySelector(`[data-photo="${key}"]`);
        const data = photoData.get(key);
        const image = card.querySelector('img');
        const photo = photoTypes.find(item => item.key === key);
        image.src = data ? data.url : photo.example;
        image.alt = !data || data.example ? `Ksenia: ${photo.name.toLowerCase()} example` : `Your selected ${photo.name.toLowerCase()}`;
        card.querySelector('.photo-frame').classList.toggle('has-photo', !!data);
        card.querySelector('.photo-frame').classList.toggle('is-example', !data || !!data.example);
        card.querySelector('.photo-action').textContent = data ? 'Change photo' : '+ Add your photo';
        card.querySelector('.photo-credit').textContent = !data || data.example ? 'Example · Ksenia' : 'Your selected photo';
        card.querySelector('.photo-remove').hidden = !data;
    }

    function showPhotoError(message) {
        photoError.textContent = message;
        photoError.hidden = !message;
    }

    document.querySelector('#digital-uploads').innerHTML = photoTypes.map((photo, index) => `
        <div class="photo-card" data-photo="${photo.key}">
            <div class="photo-frame is-example">
                <img src="${photo.example}" alt="Ksenia: ${photo.name.toLowerCase()} example">
                <span class="photo-action" aria-hidden="true">+ Add your photo</span>
                <input type="file" id="photo-${photo.key}" accept="image/jpeg,image/png,image/webp" aria-label="Add your ${photo.name.toLowerCase()} photo" aria-describedby="hint-${photo.key}">
            </div>
            <h3 id="label-${photo.key}"><span aria-hidden="true">0${index + 1}</span>${photo.name}</h3>
            <p id="hint-${photo.key}">${photo.hint}</p>
            <p class="photo-credit">Example · Ksenia</p>
            <button type="button" class="photo-remove" aria-label="Remove ${photo.name.toLowerCase()} photo" hidden>Remove</button>
        </div>`).join('');

    photoTypes.forEach(photo => {
        const input = document.querySelector(`#photo-${photo.key}`);
        input.addEventListener('change', async () => {
            const file = input.files[0];
            if (!file) return;
            if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
                showPhotoError('Please choose a JPG, PNG or WebP image smaller than 10 MB.');
                input.value = '';
                return;
            }
            const url = URL.createObjectURL(file);
            const image = new Image();
            image.src = url;
            try {
                await image.decode();
                clearPhoto(photo.key);
                photoData.set(photo.key, { url });
                renderPhoto(photo.key);
                showPhotoError('');
                status.textContent = `${photo.name} selected.`;
            } catch {
                URL.revokeObjectURL(url);
                input.value = '';
                showPhotoError('This image could not be opened. Please choose a different photo.');
            }
        });
        document.querySelector(`[data-photo="${photo.key}"] .photo-remove`).addEventListener('click', () => {
            clearPhoto(photo.key);
            input.value = '';
            renderPhoto(photo.key);
            input.focus();
            status.textContent = `${photo.name} removed.`;
        });
    });

    function validateStep() {
        const invalid = Array.from(steps[currentStep].querySelectorAll('input, select, textarea')).find(field => !field.checkValidity());
        if (invalid) { invalid.reportValidity(); return false; }
        if (currentStep === steps.length - 1 && photoData.size !== 4) {
            showPhotoError('Please select all four digitals before finishing the preview.');
            const missing = photoTypes.find(photo => !photoData.has(photo.key));
            document.querySelector(`#photo-${missing.key}`).focus();
            return false;
        }
        showPhotoError('');
        return true;
    }

    form.addEventListener('submit', event => {
        event.preventDefault();
        if (!validateStep()) return;
        if (currentStep < steps.length - 1) { moveStep(currentStep + 1); return; }
        document.querySelector('#confirmation-name').textContent = `${form.elements.fullName.value} · ${form.elements.email.value}`;
        flow.hidden = true;
        confirmation.hidden = false;
        const heading = document.querySelector('#confirmation-title');
        heading.focus({ preventScroll: true });
        heading.scrollIntoView({ block: 'center' });
    });
    backButton.addEventListener('click', () => moveStep(currentStep - 1));
    document.querySelector('#review-preview').addEventListener('click', () => {
        flow.hidden = false;
        confirmation.hidden = true;
        moveStep(0);
    });

    document.querySelector('#example-details').addEventListener('click', () => {
        const example = {
            fullName: 'Alex Example', birthDate: '2004-04-18', location: 'Bangkok, Thailand',
            email: 'alex@example.com', instagram: '@example', height: '175', bust: '82', waist: '60', hips: '90',
            tattoos: 'No', piercings: 'Yes', portfolio: '', source: 'Instagram'
        };
        Object.entries(example).forEach(([name, value]) => { form.elements.namedItem(name).value = value; });
        photoTypes.forEach(photo => {
            clearPhoto(photo.key);
            photoData.set(photo.key, { url: photo.example, example: true });
            renderPhoto(photo.key);
        });
        flow.hidden = false;
        confirmation.hidden = true;
        showPhotoError('');
        moveStep(0);
        status.textContent = 'Example details added. Ksenia’s digitals are selected for this demonstration only.';
    });
    nextButton.disabled = false;
    document.querySelector('#example-details').disabled = false;
    moveStep(0, false);
});
