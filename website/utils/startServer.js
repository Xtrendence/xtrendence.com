import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import { createServer as createSecureServer } from 'https';
import { setRoutes } from './setRoutes.js';
import { createProxies } from './createProxies.js';
import { serverOutput } from './utils.js';

export function startServer({ app, dirname, devMode }) {
    createProxies(app);
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
            serverOutput(443);
        });
    } else {
        app.listen(3000, () => {
            serverOutput(3000);
        });
    }
}
