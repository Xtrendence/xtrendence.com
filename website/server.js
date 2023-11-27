import express from 'express';
import { startServer } from './utils/startServer.js';
import { setRoutes } from './utils/setRoutes.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv;
const devMode = !args.includes('--prod');
const app = express();

setRoutes(app, __dirname);
startServer({ app, dirname: __dirname, devMode });
