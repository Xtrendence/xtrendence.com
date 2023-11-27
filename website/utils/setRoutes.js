import express from 'express';

export function setRoutes(app, dirname) {
    app.use(express.static('public'));

    app.get('/', (_, res) => {
        res.render('pages/index');
    });

    app.get(['/portfolio', '/portfolio/*'], (_, res) => {
        res.redirect('https://xtrendence.dev');
    });
}
