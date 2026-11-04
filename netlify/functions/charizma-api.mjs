import applicants from '../../api/applicants.js';
import notifications from '../../api/notifications.js';
import staff from '../../api/staff.js';
import submit from '../../api/submit.js';

const routes = new Map([
    ['/api/applicants', applicants],
    ['/api/notifications', notifications],
    ['/api/staff', staff],
    ['/api/submit', submit]
]);

export const config = { path: ['/api/applicants', '/api/notifications', '/api/staff', '/api/submit'] };

export default async function handle(request, context) {
    const url = new URL(request.url);
    const handler = routes.get(url.pathname);
    if (!handler) return new Response(null, { status: 404 });

    const body = request.method === 'POST' ? await request.text() : '';
    if (Buffer.byteLength(body) > 12000) return new Response(null, { status: 413 });
    const req = {
        method: request.method,
        url: url.pathname + url.search,
        headers: { ...Object.fromEntries(request.headers), host: url.host },
        body,
        socket: { encrypted: url.protocol === 'https:', remoteAddress: context.ip }
    };
    const headers = new Headers();
    let responseBody;
    const res = {
        statusCode: 200,
        setHeader(name, value) {
            headers.delete(name);
            for (const item of [].concat(value)) headers.append(name, item);
        },
        end(value) { responseBody = value; }
    };
    await handler(req, res);
    return new Response(responseBody, { status: res.statusCode, headers });
}
