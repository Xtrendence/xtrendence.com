import express from 'express';
import * as path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import { verifyToken } from './utils/utils.js';
import { createSocket } from './utils/socket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors({ origin: '*' }));

app.use(cookieParser());

app.use('/assets', express.static('public/assets'));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.get('/', async (req, res) => {
    res.render('pages/index');
});

app.get('/conversation', async (req, res) => {
    const token = req.cookies.token;

    const validToken = await verifyToken(token);

    if (!validToken) {
        res.redirect('/error/401');
        return;
    }

    res.render('pages/conversation');
});

app.get('/share', async (req, res) => {
    res.render('pages/share');
});

const server = app.listen(3004, () => {
    console.log('Bot server listening on port 3004');
});

createSocket(server);
