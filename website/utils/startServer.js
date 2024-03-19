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
    const certFiles = {
      key: path.join(dirname, 'certs/privkey.pem'),
      cert: path.join(dirname, 'certs/cert.pem'),
      ca: path.join(dirname, 'certs/fullchain.pem'),
    };

    const key = fs.existsSync(certFiles.key)
      ? fs.readFileSync(certFiles.key, 'utf8')
      : undefined;
    const cert = fs.existsSync(certFiles.cert)
      ? fs.readFileSync(certFiles.cert, 'utf8')
      : undefined;
    const ca = fs.existsSync(certFiles.ca)
      ? fs.readFileSync(certFiles.ca, 'utf8')
      : undefined;

    const credentials = {
      key,
      cert,
      ca,
    };

    const sslAvailable = key && cert && ca;

    console.log(credentials);

    if (sslAvailable) {
      app.enable('trust proxy');

      app.use((req, res, next) => {
        if (req.secure) {
          next();
        } else {
          res.redirect('https://www.xtrendence.com' + req.url);
        }
      });
    }

    const httpServer = createServer(app);
    httpServer.listen(80);

    if (sslAvailable) {
      const httpsServer = createSecureServer(credentials, app);
      httpsServer.listen(443, () => {
        serverOutput(443);
      });
    }
  } else {
    app.listen(3000, () => {
      serverOutput(3000);
    });
  }
}
