import express from 'express';
import { startServer } from './utils/startServer.js';
import * as path from 'path';
import { fileURLToPath } from 'url';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv;
const devMode = !args.includes('--prod');
const app = express();

app.use(bodyParser.json());
app.use(cookieParser());

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

startServer({ app, dirname: __dirname, devMode });
