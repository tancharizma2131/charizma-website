import { STAFF_EMAIL, authRequest, config, clearSession, storeSession, allowedUser, staffSession, sameOrigin, json } from '../server/staff-auth.js';

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    try {
        config();
        if (req.method === 'GET') {
            const session = await staffSession(req, res);
            return json(res, session ? 200 : 401, session ? { email: session.user.email } : { error: 'Please sign in to continue.' });
        }
        if (req.method !== 'POST') {
            res.setHeader('Allow', 'GET, POST');
            return json(res, 405, { error: 'Method not allowed.' });
        }
        if (!sameOrigin(req)) return json(res, 403, { error: 'Please use the sign-in page on this website.' });
        if (!req.headers['content-type']?.startsWith('application/json')) return json(res, 415, { error: 'Please use the sign-in form.' });
        let body = req.body;
        if (typeof body === 'string') {
            if (Buffer.byteLength(body) > 4096) return json(res, 413, { error: 'Request too large.' });
            try { body = JSON.parse(body); } catch { return json(res, 400, { error: 'Invalid request.' }); }
        }
        if (!body || typeof body !== 'object' || Array.isArray(body) || Buffer.byteLength(JSON.stringify(body)) > 4096) return json(res, 400, { error: 'Invalid request.' });
        if (body.action === 'logout') {
            try {
                const session = await staffSession(req, res);
                if (session) await authRequest('logout?scope=local', { method: 'POST', token: session.token });
            } catch {
                // Local sign-out still succeeds during an authentication outage.
            } finally { clearSession(req, res); }
            return json(res, 200, { ok: true });
        }
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        if (email !== STAFF_EMAIL) return json(res, 403, { error: 'This sign-in is for the Charizma team. Please use your staff email.' });
        if (body.action === 'request') {
            const result = await authRequest('otp', { body: { email, create_user: false } });
            if (!result.ok) return json(res, result.status === 429 ? 429 : 503, { error: result.status === 429 ? 'Please wait a minute before requesting another code.' : 'We couldn’t send a code. Please try again shortly.' });
            return json(res, 200, { ok: true });
        }
        if (body.action === 'verify') {
            if (typeof body.token !== 'string' || !/^\d{6,10}$/.test(body.token)) return json(res, 400, { error: 'Enter the code from your email.' });
            const result = await authRequest('verify', { body: { email, token: body.token, type: 'email' } });
            if (!result.ok || !allowedUser(result.data.user)) return json(res, result.status === 429 ? 429 : 401, { error: 'This code is invalid or has expired. Check your email or request a new code.' });
            storeSession(req, res, result.data);
            return json(res, 200, { email: result.data.user.email });
        }
        return json(res, 400, { error: 'Invalid request.' });
    } catch (error) {
        // Never log provider responses, email codes or session tokens.
        return json(res, 503, { error: error.message === 'AUTH_NOT_CONFIGURED' ? 'Staff sign-in is being set up. Please try again later.' : 'Sign-in is temporarily unavailable. Please try again shortly.' });
    }
}
