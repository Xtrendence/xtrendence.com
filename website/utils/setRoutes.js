import express from 'express';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function setRoutes(app) {
    app.use(express.static('public'));

    app.get('/', (_, res) => {
        res.render('pages/index');
    });

    app.get('/tools', (_, res) => {
        res.render('pages/tools');
    });

    app.get('/login', (_, res) => {
        res.render('pages/login');
    });

    app.get(['/portfolio', '/portfolio/*'], (_, res) => {
        res.redirect('https://xtrendence.dev');
    });

    app.get('/www/extras/borat.mp3', (_, res) => {
        res.sendFile(path.join(__dirname, '../public/assets/audio/borat.mp3'));
    });

    app.get('/error/:code', (req, res) => {
        const code = req.params.code;

        let message = 'Unknown error';
        switch (code) {
            case '401':
                message = `It clicks the back button on its link or else it gets the 401 again.`;
                break;
            case '404':
                message = `Weary traveler, you seem to have lost your way. This page does not exist.`;
                break;
        }

        res.render('pages/error', { code, message });
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
