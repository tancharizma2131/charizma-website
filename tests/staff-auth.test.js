import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/staff.js';
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY = 'test-public-key';
const email = 'info@charizma-mgmt.com';
const realFetch = globalThis.fetch;
function response() {
    return { headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(value) { this.body = JSON.parse(value); } };
}
async function run(body, extra = {}) {
    const req = { method: 'POST', headers: { host: 'localhost:8052', origin: 'http://localhost:8052', 'content-type': 'application/json' }, body, ...extra };
    const res = response(); await handler(req, res); return res;
}
test('rejects cross-origin requests and non-staff email without contacting Supabase', async () => {
    let calls = 0; globalThis.fetch = async () => { calls++; throw new Error(); };
    try {
        assert.equal((await run({ action: 'request', email }, { headers: { host: 'localhost:8052', origin: 'https://other.example', 'content-type': 'application/json' } })).statusCode, 403);
        assert.equal((await run({ action: 'request', email: 'other@example.com' })).statusCode, 403);
        assert.equal(calls, 0);
    } finally { globalThis.fetch = realFetch; }
});
test('requesting a code cannot create a new user', async () => {
    globalThis.fetch = async (url, options) => {
        assert.equal(new URL(url).pathname, '/auth/v1/otp');
        assert.deepEqual(JSON.parse(options.body), { email, create_user: false });
        return { ok: true, status: 200, json: async () => ({}) };
    };
    try { assert.equal((await run({ action: 'request', email })).statusCode, 200); }
    finally { globalThis.fetch = realFetch; }
});
test('unconfirmed and unauthorized users never receive a session cookie', async () => {
    for (const user of [{ id: '1', email }, { id: '1', email: 'other@example.com', email_confirmed_at: '2026-01-01' }]) {
        globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ user, access_token: 'secret-access', refresh_token: 'secret-refresh' }) });
        try {
            const res = await run({ action: 'verify', email, token: '123456' });
            assert.equal(res.statusCode, 401); assert.equal(res.headers['Set-Cookie'], undefined);
        } finally { globalThis.fetch = realFetch; }
    }
});
test('authorized verification stores tokens only in protected production cookies', async () => {
    process.env.VERCEL = '1';
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ user: { id: '1', email, email_confirmed_at: '2026-01-01' }, access_token: 'secret-access', refresh_token: 'secret-refresh', expires_in: 3600 }) });
    try {
        const res = await run({ action: 'verify', email, token: '123456' }, { headers: { host: 'charizma.example', origin: 'https://charizma.example', 'content-type': 'application/json' } });
        assert.equal(res.statusCode, 200); assert.deepEqual(res.body, { email });
        assert.equal(res.headers['Set-Cookie'].length, 2);
        for (const value of res.headers['Set-Cookie']) { assert.match(value, /HttpOnly/); assert.match(value, /SameSite=Strict/); assert.match(value, /; Secure/); }
    } finally { delete process.env.VERCEL; globalThis.fetch = realFetch; }
});
test('a forged cookie cannot grant access and provider failures are closed', async () => {
    globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
    try {
        const res = await run(undefined, { method: 'GET', headers: { cookie: 'charizma_access=forged' } });
        assert.equal(res.statusCode, 401);
        assert.match(res.headers['Set-Cookie'][0], /Max-Age=0/);
    } finally { globalThis.fetch = realFetch; }
});
test('refresh tokens are revalidated against the staff allowlist', async () => {
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ user: { id: '2', email: 'other@example.com', email_confirmed_at: '2026-01-01' }, access_token: 'other', refresh_token: 'other-refresh' }) });
    try {
        const res = await run(undefined, { method: 'GET', headers: { cookie: 'charizma_refresh=forged' } });
        assert.equal(res.statusCode, 401);
    } finally { globalThis.fetch = realFetch; }
});
