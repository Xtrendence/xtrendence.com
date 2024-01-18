import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import { createServer as createSecureServer } from 'https';
import { setRoutes } from './setRoutes.js';
import { createProxies } from './createProxies.js';
import { serverOutput } from './utils.js';

export function startServer({ app, dirname, devMode }) {
    createProxies(app, devMode);
    setRoutes(app);

    if (!devMode) {
        const challenges = [
            {
                data: 'w2Q-mFnf0d5TtDTIMOcOVriTibKK5-p_A88gsbwFxFw.csEnSY-kKtFa3mGMrLKRhi094S5n5IJGz8TKo9xfSvo',
                url: 'w2Q-mFnf0d5TtDTIMOcOVriTibKK5-p_A88gsbwFxFw',
            },
            {
                data: 'cFez2BpM-XnhO5wr9AH8-Gc_6fzRpmzfM45Xu0KlUPE.csEnSY-kKtFa3mGMrLKRhi094S5n5IJGz8TKo9xfSvo',
                url: 'cFez2BpM-XnhO5wr9AH8-Gc_6fzRpmzfM45Xu0KlUPE',
            },
        ];

        challenges.map((challenge) => {
            app.get(
                `/.well-known/acme-challenge/${challenge.url}`,
                (_, res) => {
                    res.send(challenge.data);
                }
            );
        });

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

        app.enable('trust proxy');

        app.use((req, res, next) => {
            if (req.secure) {
                next();
            } else {
                res.redirect('https://www.xtrendence.com' + req.url);
            }
        });

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
