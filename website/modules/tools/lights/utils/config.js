import * as path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { validJSON } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getConfig() {
    const config = path.join(__dirname, '../config.cfg');
    const content = fs.readFileSync(config, 'utf8');

    return JSON.parse(content);
}

export function setConfig(config) {
    const currentConfig = getConfig();

    const newConfig = {
        ...currentConfig,
        ...config,
    };

    fs.writeFileSync(
        path.join(__dirname, '../config.cfg'),
        JSON.stringify(newConfig)
    );
}

export function resetConfig() {
    fs.writeFileSync(
        path.join(__dirname, '../config.cfg'),
        JSON.stringify({
            ip: '127.0.0.1',
            port: '55443',
            guest: false,
        })
    );
}

export function checkConfig() {
    if (!fs.existsSync(path.join(__dirname, '../config.cfg'))) {
        resetConfig();
    }

    const content = fs.readFileSync(
        path.join(__dirname, '../config.cfg'),
        'utf8'
    );

    if (!content || !validJSON(content)) {
        resetConfig();
    }
}
