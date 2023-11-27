import express from 'express';

export function setRoutes(app, dirname) {
    app.use(express.static('public'));

    app.get('/', (_, res) => {
        res.sendFile(path.join(dirname, '../public/index.html'));
    });
}
