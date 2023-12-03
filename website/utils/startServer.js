import fs from 'fs';
import path from 'path';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import { createServer } from 'http';
import { createServer as createSecureServer } from 'https';
import { setRoutes } from './setRoutes.js';

function output(port) {
    console.log(
        '\n\n\x1b[35m%s\x1b[0m',
        `----------------------------------------`
    );

    console.log('\x1b[35m%s\x1b[0m', `Server listening on port ${port}`);

    console.log(
        '\x1b[35m%s\x1b[0m',
        `----------------------------------------`
    );

    console.log(`Shortcuts:`);
    console.log('\x1b[34m%s\x1b[0m', `http://xtrendence.com`);
    console.log('\x1b[34m%s\x1b[0m', `http://localhost:${port}`);
    console.log('\x1b[34m%s\x1b[0m', `http://192.168.1.50:${port}`);
    console.log('\x1b[34m%s\x1b[0m', `http://192.168.1.95:${port}`);
}

export function startServer({ app, dirname, devMode }) {
    app.use(
        '/tools/lights',
        createProxyMiddleware({
            target: 'http://localhost:3001',
            changeOrigin: true,
            onProxyReq: fixRequestBody,
        })
    );

    app.use(
        '/auth',
        createProxyMiddleware({
            target: 'http://localhost:3002',
            changeOrigin: false,
            onProxyReq: fixRequestBody,
        })
    );

    setRoutes(app);

    if (!devMode) {
        const key = fs.readFileSync(
            path.join(dirname, 'certs/privkey.pem'),
            'utf8'
        );
        const cert = fs.readFileSync(
            path.join(dirname, 'certs/cert.pem'),
            'utf8'
        );
        const ca = fs.readFileSync(
            path.join(dirname, 'certs/fullchain.pem'),
            'utf8'
        );

        const credentials = {
            key,
            cert,
            ca,
        };

        console.log(credentials);

        const httpServer = createServer(app);
        const httpsServer = createSecureServer(credentials, app);

        httpServer.listen(80);

        httpsServer.listen(443, () => {
            output(443);
        });
    } else {
        app.listen(3000, () => {
            output(3000);
        });
    }
}
