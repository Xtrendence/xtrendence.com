import fs from 'fs';
import { getFiles } from './utils.js';

const files = getFiles();

export function getFcmTokens() {
    const content = fs.readFileSync(files.fcmTokensFile, 'utf8');
    return JSON.parse(content) || [];
}

export function fcmTokenExists(fcmToken) {
    const fcmTokens = getFcmTokens();
    return fcmTokens.includes(fcmToken);
}

export function saveFcmToken(fcmToken) {
    const fcmTokens = getFcmTokens();

    if (fcmTokens.includes(fcmToken)) return;

    fcmTokens.push(fcmToken);

    if (fcmTokens.length > 5) {
        fcmTokens.shift();
    }

    fs.writeFileSync(files.fcmTokensFile, JSON.stringify(fcmTokens));
}
