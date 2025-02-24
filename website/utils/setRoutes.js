import express from 'express';
import { logout, verifyToken } from './utils.js';
import QRCode from 'qrcode-svg';

// ACME challenges for SSL certificate renewal.
const challenges = [
    {
        data: '7Svoke4Pr-E05HHazdoUmEYYC93HT2TG059IVmEywIQ.4Q2WT1EKuJWpxONTEpneUbSagIFkQbvcaiiSWyV39oM',
        url: '7Svoke4Pr-E05HHazdoUmEYYC93HT2TG059IVmEywIQ',
    },
    {
        data: 'EeWT0QMmtWib-hM9yWSNgpe6mSwl_EPhD5C1nrQ5V5U.4Q2WT1EKuJWpxONTEpneUbSagIFkQbvcaiiSWyV39oM',
        url: 'EeWT0QMmtWib-hM9yWSNgpe6mSwl_EPhD5C1nrQ5V5U',
    },
];

export function setRoutes(app) {
    app.use('/', express.static('public'));

    app.get('/', (_, res) => {
        res.render('pages/index');
    });

    app.get('/tools', async (req, res) => {
        const token = req.cookies.token;

        const validToken = await verifyToken(token);

        if (!validToken) {
            res.status(401).send(
                '<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=/error/401"></head></html>'
            );
            return;
        }

        res.render('pages/tools');
    });

    app.get('/login', async (req, res) => {
        const token = req.cookies.token;

        const validToken = await verifyToken(token);

        if (validToken) {
            res.redirect('/');
            return;
        }

        res.render('pages/login');
    });

    app.get('/account', async (req, res) => {
        const token = req.cookies.token;

        const validToken = await verifyToken(token);

        if (!validToken) {
            res.status(401).send(
                '<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=/error/401"></head></html>'
            );
            return;
        }

        res.render('pages/account');
    });

    app.get('/logout', async (req, res) => {
        const token = req.cookies.token;
        await logout(token);
        res.clearCookie('token');
        res.redirect('/');
    });

    app.get('/wifi', async (req, res) => {
        const token = req.cookies.token;

        const validToken = await verifyToken(token);

        if (!validToken) {
            res.status(401).send(
                '<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=/error/401"></head></html>'
            );
            return;
        }

        const wpa = process.env.WIFI_WPA || '';
        const network = process.env.WIFI_NETWORK || '';
        const type = process.env.WIFI_TYPE || '';

        const qr = `WIFI:T:${type};S:${network};P:${wpa};;`;

        const qrcode = new QRCode({
            background: '#0000',
            color: '#fff',
            content: qr,
            ecl: 'H',
            padding: 0,
        });

        const svg = qrcode.svg();

        res.render('pages/wifi', { svg, qr });
    });

    app.get(['/portfolio', '/portfolio/*'], (_, res) => {
        res.redirect('https://xtrendence.dev');
    });

    app.get('/error/:code', (req, res) => {
        const code = req.params.code;

        let message = 'Unknown error';
        let status = 'Unknown status';
        switch (code) {
            case '401':
                message = `It clicks the back button on its link or else it gets the 401 again.`;
                status = 'Unauthorized';
                break;
            case '404':
                message = `Weary traveler, you seem to have lost your way. This page does not exist.`;
                status = 'Not Found';
                break;
        }

        res.render('pages/error', { code, message, status });
    });

    app.get('/privacy/mobile', (_, res) => {
        res.send(
            'This app does not collect any personal data. All data is stored locally on your device.'
        );
    });

    challenges.map((challenge) => {
        app.get(`/.well-known/acme-challenge/${challenge.url}`, (_, res) => {
            res.send(challenge.data);
        });
    });

    app.get('*', function (_, res) {
        res.status(404).send(
            '<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=/error/404"></head></html>'
        );
    });

    app.use((_, res) => {
        res.status(401).send(
            '<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=/error/401"></head></html>'
        );

        res.status(404).send(
            '<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=/error/404"></head></html>'
        );
    });
}
