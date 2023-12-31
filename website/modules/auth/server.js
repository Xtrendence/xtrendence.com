import express from 'express';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { stringifyCircular, getBody } from './utils/utils.js';
import { existsSync, mkdirSync } from 'fs';
import { checkAccount, getAccount, validAccount } from './utils/account.js';
import {
    checkSessions,
    createSession,
    removeSession,
    validSession,
} from './utils/sessions.js';
import bodyParser from 'body-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const db = path.join(__dirname, './db');

if (!existsSync(db)) {
    mkdirSync(db);
}

checkAccount();
checkSessions();

app.use(bodyParser.json());

app.get('/', (req, res) => {
    const devMode = req.headers['dev-mode'] === 'true';

    const authRequest = {
        local: {
            localAddress: req.headers['local-address'],
            remoteAddress: req.headers['remote-address'],
            localRequest:
                req.headers['local-address'] === req.headers['remote-address'],
        },
        environment: {
            devMode: req.headers['dev-mode'],
        },
        connection: req.socket,
        request: req,
        headers: req.headers,
    };

    res.write(
        devMode ? stringifyCircular(authRequest, 4) : 'Disabled in production.'
    );
    res.end();
});

app.post('/', async (req, res) => {
    try {
        const body = await getBody(req);

        const { username, password } = body;

        if (!username || !password) {
            res.status(400).json({
                error: 'Missing required parameters.',
            });

            return;
        }

        if (!validAccount(username, password)) {
            res.status(401).json({
                error: 'Invalid credentials.',
            });

            return;
        }

        const token = createSession();

        res.cookie('token', token, { maxAge: 1000 * 60 * 60 * 24 * 30 * 6 });

        return res.status(200).json({
            token,
        });
    } catch (error) {
        console.log(error);
        res.status(500).send('Internal server error.');
    }
});

app.post('/verify', async (req, res) => {
    try {
        const body = await getBody(req);

        const { token } = body;

        if (!token) {
            res.status(400).json({
                error: 'Missing required parameters.',
            });

            return;
        }

        if (!validSession(token)) {
            res.status(401).json({
                error: 'Invalid session token.',
            });

            return;
        }

        const account = getAccount();

        return res.status(200).json({
            valid: true,
            username: account.username,
        });
    } catch (error) {
        console.log(error);
        res.status(500).send('Internal server error.');
    }
});

app.post('/logout', async (req, res) => {
    try {
        const body = await getBody(req);

        const { token } = body;

        if (!token) {
            res.status(400).json({
                error: 'Missing required parameters.',
            });

            return;
        }

        if (!validSession(token)) {
            res.status(401).json({
                error: 'Invalid session token.',
            });

            return;
        }

        removeSession(token);

        return res.status(200).json({
            success: true,
        });
    } catch (error) {
        console.log(error);
        res.status(500).send('Internal server error.');
    }
});

app.listen(3002, () => {
    console.log('Auth server listening on port 3002');
});
