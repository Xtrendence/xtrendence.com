import express from 'express';
import { logout, verifyToken } from './utils.js';

// ACME challenges for SSL certificate renewal.
const challenges = [
  {
    data: 'CxYzgJvgpwnefsFAPaMzO7I5Nm3P2pFyppX2eWMFYWA.4Q2WT1EKuJWpxONTEpneUbSagIFkQbvcaiiSWyV39oM',
    url: 'CxYzgJvgpwnefsFAPaMzO7I5Nm3P2pFyppX2eWMFYWA',
  },
  {
    data: 'h08fK-1zt9rLzjjmLWqVZA1ZVgsCzj_IpuqYQ-yO3QM.4Q2WT1EKuJWpxONTEpneUbSagIFkQbvcaiiSWyV39oM',
    url: 'h08fK-1zt9rLzjjmLWqVZA1ZVgsCzj_IpuqYQ-yO3QM',
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
      res
        .status(401)
        .send(
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
      res
        .status(401)
        .send(
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

  challenges.map((challenge) => {
    app.get(`/.well-known/acme-challenge/${challenge.url}`, (_, res) => {
      res.send(challenge.data);
    });
  });

  app.get('*', function (_, res) {
    res
      .status(404)
      .send(
        '<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=/error/404"></head></html>'
      );
  });

  app.use((_, res) => {
    res
      .status(401)
      .send(
        '<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=/error/401"></head></html>'
      );

    res
      .status(404)
      .send(
        '<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=/error/404"></head></html>'
      );
  });
}
