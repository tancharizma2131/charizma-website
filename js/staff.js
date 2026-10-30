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

    const emailForm = document.querySelector('#staff-email-form');
    const codeForm = document.querySelector('#staff-code-form');
    const message = document.querySelector('#staff-message');
    const signIn = document.querySelector('#sign-in-panel');
    const signedIn = document.querySelector('#signed-in-panel');
    const resend = document.querySelector('#send-again');
    let email;
    let busy = false;
    let resendAt = 0;
    let timer;
    async function request(body) {
        const { response, data } = await boundedRequest(body ? '/api/staff' : `/api/staff?check=${crypto.randomUUID()}`, {
            method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
            ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {})
        });
        if (!response.ok) throw new Error(data.error || 'Sign-in is temporarily unavailable. Please try again.');
        return data;
    }
    function showSession(data, focus = false) {
        document.querySelector('#staff-identity').textContent = data.email;
        codeForm.reset();
        signIn.hidden = true;
        signedIn.hidden = false;
        message.textContent = '';
        if (focus) document.querySelector('#signed-in-title').focus();
    }
    function updateResend() {
        const seconds = Math.max(0, Math.ceil((resendAt - Date.now()) / 1000));
        resend.disabled = busy || seconds > 0;
        resend.textContent = seconds ? `Send another code in ${seconds}s` : 'Send another code';
        if (!seconds) clearInterval(timer);
    }
    async function perform(action) {
        if (busy) return;
        busy = true;
        document.querySelectorAll('.staff-shell button').forEach(button => button.disabled = true);
        message.textContent = '';
        try { await action(); } catch (error) { message.textContent = error.message || 'Couldn’t connect. Please try again.'; }
        finally {
            busy = false;
            document.querySelectorAll('.staff-shell button').forEach(button => button.disabled = false);
            updateResend();
        }
    }
    async function sendCode() {
        await request({ action: 'request', email });
        emailForm.hidden = true;
        codeForm.hidden = false;
        document.querySelector('#sent-to').textContent = email;
        document.querySelector('#staff-code').focus();
        message.textContent = 'Check your inbox for your sign-in code.';
        resendAt = Date.now() + 60000;
        clearInterval(timer);
        timer = setInterval(updateResend, 1000);
    }
    emailForm.addEventListener('submit', event => {
        event.preventDefault();
        email = emailForm.elements.email.value.trim().toLowerCase();
        perform(sendCode);
    });
    codeForm.addEventListener('submit', event => {
        event.preventDefault();
        perform(async () => showSession(await request({ action: 'verify', email, token: codeForm.elements.token.value.trim() }), true));
    });
    resend.addEventListener('click', () => { if (Date.now() >= resendAt) perform(sendCode); });
    document.querySelector('#sign-out').addEventListener('click', () => perform(async () => {
        await request({ action: 'logout' });
        signedIn.hidden = true;
        signIn.hidden = false;
        emailForm.hidden = false;
        codeForm.hidden = true;
        codeForm.reset();
        message.textContent = 'You’re signed out.';
        document.querySelector('#staff-email').focus();
    }));
    request().then(data => showSession(data)).catch(() => {});
});
