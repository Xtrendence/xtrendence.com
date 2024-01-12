import express from 'express';
import * as path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import { getBody, getFiles, verifyToken } from './utils/utils.js';
import { createSocket } from './utils/socket.js';
import { encrypt } from './utils/encryption.js';
import {
    fcmTokenExists,
    getFcmTokens,
    saveFcmToken,
} from './utils/notifications.js';
import fs from 'fs';
import * as dotenv from 'dotenv';
import admin from 'firebase-admin';
import { saveMessage } from './utils/messages.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
    path: path.join(__dirname, './.env'),
});

const files = getFiles();

const serviceAccount = fs.readFileSync(files.firebaseFile, 'utf8');
admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(serviceAccount)),
});

const app = express();

app.use(cors({ origin: '*' }));

app.use(cookieParser());

app.use('/assets', express.static('public/assets'));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.get('/', async (_, res) => {
    res.render('pages/index');
});

app.post('/fcm', async (req, res) => {
    const body = await getBody(req);

    const token = req.cookies.token || body.token;

    const validToken = await verifyToken(token);

    if (!validToken) {
        res.redirect('/error/401');
        return;
    }

    if (!body?.fcmToken) {
        res.status(400).json({ error: 'Missing fcmToken' });
        return;
    }

    saveFcmToken(body.fcmToken);

    if (fcmTokenExists(body.fcmToken)) {
        res.status(200).json({ message: 'Token saved' });
        return;
    }

    res.status(500).json({ error: 'Failed to save token' });
});

app.get('/fcm/key', async (req, res) => {
    const token = req.cookies.token || req.query.token;

    const validToken = await verifyToken(token);

    if (!validToken) {
        res.redirect('/error/401');
        return;
    }

    res.json({
        key: process.env.FIREBASE_ENCRYPTION_KEY,
        iv: process.env.FIREBASE_ENCRYPTION_IV,
    });
});

app.get('/fcm/:token', async (req, res) => {
    try {
        const { token } = req.params;

        const title = req.query.title || 'Notification Title';
        const body = req.query.body || 'Notification Body';

        const validToken = await verifyToken(token);

        if (!validToken) {
            res.redirect('/error/401');
            return;
        }

        const fcmTokens = getFcmTokens();

        if (fcmTokens.length === 0) {
            res.status(500).json({ error: 'No tokens found' });
            return;
        }

        await admin.messaging().sendEachForMulticast({
            tokens: fcmTokens,
            data: {
                notifee: JSON.stringify({
                    title: encrypt(title),
                    body: encrypt(body),
                }),
            },
        });

        saveMessage({
            response: `*${title}*\n${body}`,
        });

        res.json({
            message: 'Notifications sent.',
        });
    } catch (error) {
        console.log(error);
    }
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
