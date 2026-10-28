import { config } from './staff-auth.js';
export const STATUSES = ['New', 'Reviewing', 'Contacted', 'Archived'];
export const isId = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const summary = 'id,full_name,location,height,email,status,source,submitted_at';
const detail = `${summary},birth_date,instagram,bust_chest,waist,hips,tattoos,piercings,heard_about,portfolio_url,legacy_photo_urls,updated_at`;
export async function dataRequest(session, path, { method = 'GET', body, count = false } = {}) {
    const { url, key } = config();
    const response = await fetch(`${url}/rest/v1/${path}`, {
        method, cache: 'no-store', headers: { 'Cache-Control': 'no-cache', apikey: key, Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json', Prefer: `${count ? 'count=exact,' : ''}return=representation` },
        ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) throw new Error('RECORDS_UNAVAILABLE');
    const data = await response.json();
    const countHeader = response.headers.get('content-range')?.split('/')[1];
    return { data, total: countHeader && countHeader !== '*' ? Number(countHeader) : null };
}
export function listQuery(params) {
    const status = params.get('status') || 'All';
    const source = params.get('source') || 'all';
    const page = Number(params.get('page') || 0);
    const sort = params.get('sort') || 'newest';
    const search = (params.get('search') || '').trim();
    if (!['All', ...STATUSES].includes(status) || !['all', 'Website', 'Google Form'].includes(source) || !Number.isInteger(page) || page < 0 || page > 20000 || !['newest', 'oldest'].includes(sort) || search.length > 200) throw new Error('INVALID_FILTER');
    const query = new URLSearchParams({ select: summary, order: `submitted_at.${sort === 'oldest' ? 'asc' : 'desc'},id.asc`, limit: '50', offset: String(page * 50) });
    if (status !== 'All') query.set('status', `eq.${status}`);
    if (source !== 'all') query.set('source', `eq.${source}`);
    if (search) {
        // Quote the PostgREST filter value so punctuation cannot add operators.
        const value = search.replace(/[\\%_*]/g, '\\$&').replace(/"/g, '\\"');
        query.set('or', `(full_name.ilike."*${value}*",location.ilike."*${value}*",email.ilike."*${value}*")`);
    }
    return { path: `applications?${query}`, page };
}
export async function applicantDetail(session, id) {
    const base = await dataRequest(session, `applications?${new URLSearchParams({ select: detail, id: `eq.${id}` })}`);
    const record = base.data[0];
    if (!record) return null;
    const results = await Promise.all([
        dataRequest(session, `application_photos?${new URLSearchParams({ select: 'id,kind,mime_type', application_id: `eq.${id}` })}`),
        dataRequest(session, `application_notes?${new URLSearchParams({ select: 'id,body,created_at', application_id: `eq.${id}`, order: 'created_at.desc,id.desc', limit: '100' })}`),
        dataRequest(session, `application_events?${new URLSearchParams({ select: 'id,event_type,details,occurred_at', application_id: `eq.${id}`, order: 'occurred_at.desc,id.desc', limit: '100' })}`)
    ]);
    return { ...record, photos: results[0].data, notes: results[1].data, events: results[2].data };
}
export async function photoUrl(session, applicationId, photoId) {
    const photos = await dataRequest(session, `application_photos?${new URLSearchParams({ select: 'storage_path', id: `eq.${photoId}`, application_id: `eq.${applicationId}` })}`);
    if (!photos.data[0]) return null;
    const { url, key } = config();
    const path = photos.data[0].storage_path.split('/').map(encodeURIComponent).join('/');
    const response = await fetch(`${url}/storage/v1/object/sign/application-digitals/${path}`, {
        method: 'POST', headers: { apikey: key, Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresIn: 300 }), signal: AbortSignal.timeout(12000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.signedURL) throw new Error('PHOTO_UNAVAILABLE');
    return `${url}/storage/v1${data.signedURL}`;
}
