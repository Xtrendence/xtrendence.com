import * as path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { validJSON } from './utils.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = path.join(__dirname, '../db');
const account = path.join(db, 'account.db');

export function getAccount() {
    const content = readFileSync(account);
    if (validJSON(content)) {
        return JSON.parse(content);
    }

    return resetAccount();
}

export function validAccount(username, password) {
    const account = getAccount();

    if (account.username === username) {
        return bcrypt.compareSync(password, account.password);
    }

    return false;
}

export function resetAccount() {
    const password = randomBytes(32).toString('hex');

    console.log('\x1b[33m%s\x1b[0m', `Account created. Password: ${password}`);

    const content = {
        username: 'Xtrendence',
        password: bcrypt.hashSync(password, 12),
    };

    writeFileSync(account, JSON.stringify(content));

    return content;
}

export function checkAccount() {
    if (!existsSync(account) || !readFileSync(account)) {
        resetAccount();
    }
}
