import express from 'express';

export function setRoutes(app) {
    app.use(express.static('public'));

    app.get('/', (_, res) => {
        res.render('pages/index');
    });

    app.get('/tools', (_, res) => {
        res.render('pages/tools');
    });

    app.get(['/portfolio', '/portfolio/*'], (_, res) => {
        res.redirect('https://xtrendence.dev');
    });

    app.use((_, res) => {
        res.status(401).send('401 Unauthorized');
    });

    app.use((_, res) => {
        res.status(404).send('404 Not Found');
    });
}
