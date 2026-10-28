// Local application server. Only public site assets are served; credentials and
// backend sources are never available through the static file handler.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import handler from '../api/staff.js';
import applicantsHandler from '../api/applicants.js';
import submitHandler from '../api/submit.js';
import notificationsHandler from '../api/notifications.js';
if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const root = resolve('.');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const server = http.createServer(async (req, res) => {
    try {
        const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        if (['/api/staff', '/api/applicants', '/api/submit', '/api/notifications'].includes(pathname)) {
            const chunks = [];
            let size = 0;
            for await (const chunk of req) {
                size += chunk.length;
                if (size > 12000) { res.writeHead(413); res.end(); return; }
                chunks.push(chunk);
            }
            req.body = Buffer.concat(chunks).toString();
            await ({'/api/staff':handler,'/api/applicants':applicantsHandler,'/api/submit':submitHandler,'/api/notifications':notificationsHandler}[pathname])(req,res);
            return;
        }
        if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
        const name = pathname === '/' ? '/index.html' : pathname;
        const file = resolve(root, '.' + name);
        const allowed = /^\/[a-z0-9][a-z0-9.-]*\.(html|css|ico)$/i.test(name) || /^\/(image|fonts)\//.test(name) || /^\/js\/[a-z0-9.-]+\.js$/i.test(name);
        if (!allowed || !file.startsWith(root + sep) || name.split('/').some(part => part.startsWith('.')) || !types[extname(file)]) { res.writeHead(404); res.end(); return; }
        const content = await readFile(file);
        res.writeHead(200, { 'Content-Type': types[extname(file)], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        res.end(req.method === 'HEAD' ? undefined : content);
    } catch { res.writeHead(404); res.end(); }
});
server.listen(Number(process.env.APP_PORT || 8052), '127.0.0.1', () => console.log('Charizma application server: http://127.0.0.1:' + server.address().port));
