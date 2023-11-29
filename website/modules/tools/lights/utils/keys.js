import * as path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { validJSON } from './utils.js';
import { randomBytes } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getKeys() {
    const keys = path.join(__dirname, '../keys.cfg');
    const content = fs.readFileSync(keys, 'utf8');

    return JSON.parse(content);
}

export function resetKeys() {
    const admin = randomBytes(64).toString('hex');
    const guest = randomBytes(64).toString('hex');

    fs.writeFileSync(
        path.join(__dirname, '../keys.cfg'),
        JSON.stringify({
            admin: `admin-${admin}`,
            guest: `guest-${guest}`,
        })
    );
}

export function checkKeys() {
    if (!fs.existsSync(path.join(__dirname, '../keys.cfg'))) {
        resetKeys();
    }

    const content = fs.readFileSync(
        path.join(__dirname, '../keys.cfg'),
        'utf8'
    );

    if (!content || !validJSON(content)) {
        resetKeys();
    }
}

export function validKey(key, type) {
    const keys = getKeys();

    if (type === 'admin') {
        return key === keys.admin;
    }

    if (type === 'guest') {
        return key === keys.guest;
    }

    return false;
}
