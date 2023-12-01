import * as path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { validJSON } from './utils.js';
import { randomBytes } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const keysFile = path.join(__dirname, '../keys.db');

export function getKeys() {
    const content = fs.readFileSync(keysFile, 'utf8');

    return JSON.parse(content);
}

export function resetKeys() {
    const keys = [];
    for (let i = 0; i < 10; i++) {
        keys.push(`guest-${i}-${randomBytes(32).toString('hex')}`);
    }

    fs.writeFileSync(keysFile, JSON.stringify(keys, null, 4));
}

export function checkKeys() {
    if (!fs.existsSync(keysFile)) {
        resetKeys();
    }

    const content = fs.readFileSync(keysFile, 'utf8');

    if (!content || !validJSON(content) || JSON.parse(content).length === 0) {
        resetKeys();
    }
}

export function validKey(key) {
    const keys = getKeys();

    if (keys.includes(key)) {
        return true;
    }

    return false;
}
