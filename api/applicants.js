import { staffSession, sameOrigin, json } from '../server/staff-auth.js';
import { STATUSES, isId, dataRequest, listQuery, applicantDetail, photoUrl } from '../server/applicants.js';
export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    try {
        if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); return json(res, 405, { error: 'Method not allowed.' }); }
        if (req.method === 'POST' && (!sameOrigin(req) || !req.headers['content-type']?.startsWith('application/json'))) return json(res, 403, { error: 'Please use the dashboard on this website.' });
        const session = await staffSession(req, res);
        if (!session) return json(res, 401, { error: 'Your session has ended. Please sign in again.' });
        const params = new URL(req.url, 'http://localhost').searchParams;
        const id = params.get('id');
        if (req.method === 'GET') {
            if (id && !isId(id)) return json(res, 400, { error: 'Invalid applicant.' });
            const photo = params.get('photo');
            if (photo) {
                if (!isId(id) || !isId(photo)) return json(res, 400, { error: 'Invalid photo.' });
                const signed = await photoUrl(session, id, photo);
                return json(res, signed ? 200 : 404, signed ? { url: signed } : { error: 'Photo not found.' });
            }
            if (id) {
                const record = await applicantDetail(session, id);
                return json(res, record ? 200 : 404, record || { error: 'Application not found.' });
            }
            const query = listQuery(params);
            const result = await dataRequest(session, query.path, { count: true });
            return json(res, 200, { records: result.data, total: result.total ?? result.data.length, page: query.page });
        }
        let body = req.body;
        if (typeof body === 'string') {
            if (Buffer.byteLength(body) > 8192) return json(res, 413, { error: 'Request too large.' });
            try { body = JSON.parse(body); } catch { return json(res, 400, { error: 'Invalid request.' }); }
        }
        if (!body || !isId(body.id) || Buffer.byteLength(JSON.stringify(body)) > 8192) return json(res, 400, { error: 'Invalid applicant.' });
        if (body.action === 'status') {
            if (!STATUSES.includes(body.status)) return json(res, 400, { error: 'Invalid application status.' });
            const query = new URLSearchParams({ id: `eq.${body.id}`, select: 'id,status,updated_at' });
            const result = await dataRequest(session, `applications?${query}`, { method: 'PATCH', body: { status: body.status } });
            return json(res, result.data.length ? 200 : 404, result.data.length ? { ok: true } : { error: 'Application not found.' });
        }
        if (body.action === 'note') {
            if (typeof body.text !== 'string' || !body.text.trim() || body.text.trim().length > 2000) return json(res, 400, { error: 'Write a note of up to 2,000 characters.' });
            await dataRequest(session, 'application_notes?select=id', { method: 'POST', body: { application_id: body.id, author_id: session.user.id, body: body.text.trim() } });
            return json(res, 200, { ok: true });
        }
        return json(res, 400, { error: 'Invalid request.' });
    } catch (error) {
        return json(res, error.message === 'INVALID_FILTER' ? 400 : 503, { error: error.message === 'INVALID_FILTER' ? 'Please check the search filters.' : 'We couldn’t load or save the application. Please try again.' });
    }
}
