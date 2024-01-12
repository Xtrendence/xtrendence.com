import * as path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { randomBytes } from 'crypto';
import { validJSON } from './utils.js';
import QRCode from 'qrcode-svg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = path.join(__dirname, '../db');
const sessions = path.join(db, 'sessions.db');

export function getSessions() {
    const content = readFileSync(sessions);
    if (validJSON(content)) {
        return JSON.parse(content);
    }

    resetSessions();

    return [];
}

export function createSession() {
    const token = randomBytes(32).toString('hex');

    // Expires in 6 months.
    const expires = Date.now() + 1000 * 60 * 60 * 24 * 30 * 6;

    const content = getSessions();
    content.push({
        token,
        expires,
    });

    // Limit to 20 sessions.
    if (content.length > 20) {
        content.shift();
    }

    writeFileSync(sessions, JSON.stringify(content));

    return token;
}

export function validSession(token) {
    const sessions = getSessions();
    for (const session of sessions) {
        if (session.token === token && session.expires > Date.now()) {
            return true;
        }
    }

    return false;
}

export function getSessionQRCode(token) {
    const valid = validSession(token);

    if (!valid) {
        return null;
    }

    const svg = new QRCode({
        background: '#0000',
        color: '#000',
        content: token,
        ecl: 'H',
        padding: 0,
    });

    return svg;
}

export function removeSession(token) {
    const content = getSessions();
    for (let i = 0; i < content.length; i++) {
        if (content[i].token === token) {
            content.splice(i, 1);
            break;
        }
    }

    writeFileSync(sessions, JSON.stringify(content));
}

export function resetSessions() {
    writeFileSync(sessions, JSON.stringify([]));
}

export function checkSessions() {
    if (!existsSync(sessions) || !readFileSync(sessions)) {
        resetSessions();
    }
}
