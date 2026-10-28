// Server-only authentication. Never send Supabase session tokens to page JavaScript.
export const STAFF_EMAIL = 'info@charizma-mgmt.com';
const ACCESS = 'charizma_access';
const REFRESH = 'charizma_refresh';

export function config() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error('AUTH_NOT_CONFIGURED');
    if (new URL(url).protocol !== 'https:') throw new Error('AUTH_NOT_CONFIGURED');
    return { url: url.replace(/\/$/, ''), key };
}
export async function authRequest(path, { body, token, method = body ? 'POST' : 'GET' } = {}) {
    const { url, key } = config();
    const response = await fetch(`${url}/auth/v1/${path}`, {
        method,
        cache: 'no-store',
        headers: { apikey: key, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(12000)
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
}
function cookies(req) {
    return Object.fromEntries((req.headers.cookie || '').split(';').map(part => {
        const i = part.indexOf('=');
        return i < 0 ? ['', ''] : [part.slice(0, i).trim(), part.slice(i + 1)];
    }));
}
function secure(req) {
    return process.env.VERCEL || process.env.NODE_ENV === 'production' || req.socket?.encrypted;
}
function cookie(req, name, value, age) {
    if (!/^[A-Za-z0-9._~-]*$/.test(value)) throw new Error('INVALID_SESSION');
    return `${name}=${value}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${age}${secure(req) ? '; Secure' : ''}`;
}
export function clearSession(req, res) {
    res.setHeader('Set-Cookie', [cookie(req, ACCESS, '', 0), cookie(req, REFRESH, '', 0)]);
}
export function storeSession(req, res, session) {
    if (!session.access_token || !session.refresh_token) throw new Error('INVALID_SESSION');
    const expires = Math.min(Number(session.expires_in) || 3600, 3600);
    res.setHeader('Set-Cookie', [cookie(req, ACCESS, session.access_token, expires), cookie(req, REFRESH, session.refresh_token, 86400)]);
}
export function allowedUser(user) {
    return !!user?.id && user.email?.toLowerCase() === STAFF_EMAIL && !!user.email_confirmed_at;
}
export async function staffSession(req, res) {
    const saved = cookies(req);
    if (saved[ACCESS]) {
        const user = await authRequest('user', { token: saved[ACCESS] });
        if (user.ok && allowedUser(user.data)) return { user: user.data, token: saved[ACCESS] };
        if (!user.ok && user.status >= 500) throw new Error('AUTH_UNAVAILABLE');
    }
    if (saved[REFRESH]) {
        const refreshed = await authRequest('token?grant_type=refresh_token', { body: { refresh_token: saved[REFRESH] } });
        if (refreshed.ok && allowedUser(refreshed.data.user)) {
            storeSession(req, res, refreshed.data);
            return { user: refreshed.data.user, token: refreshed.data.access_token };
        }
        if (!refreshed.ok && refreshed.status >= 500) throw new Error('AUTH_UNAVAILABLE');
    }
    clearSession(req, res);
    return null;
}
export function sameOrigin(req) {
    // JSON POSTs must originate from the same website, including on preview deployments.
    const protocol = secure(req) ? 'https' : 'http';
    return req.headers.origin === `${protocol}://${req.headers.host}`;
}
export function json(res, status, data) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vary', 'Cookie');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(JSON.stringify(data));
}
