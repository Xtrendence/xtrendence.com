import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataFolder = path.join(__dirname, '../data');
const fcmTokensFile = path.join(__dirname, '../data/fcmTokens.db');
const messagesFolder = path.join(__dirname, '../data/messages');

export function getFiles() {
    if (!fs.existsSync(dataFolder)) {
        fs.mkdirSync(dataFolder);
    }

    if (!fs.existsSync(fcmTokensFile)) {
        fs.writeFileSync(fcmTokensFile, JSON.stringify([]));
    }

    if (!fs.existsSync(messagesFolder)) {
        fs.mkdirSync(messagesFolder);
    }

    return {
        dataFolder,
        fcmTokensFile,
        messagesFolder,
    };
}

export function sanitizeMessage(message) {
    // Lowercase and trim the message. Replace multiple spaces with a single space. Replace question marks with empty strings. Replace exclamation marks with empty strings. Replace periods with empty strings. Replace commas with empty strings.
    return message
        .toLowerCase()
        .trim()
        .replace(/\s\s+/g, ' ')
        .replace(/\?/g, '')
        .replace(/!/g, '')
        .replace(/\./g, '')
        .replace(/,/g, '');
}

export function getOrdinal(number) {
    if (number > 3 && number < 21) return 'th';
    switch (number % 10) {
        case 1:
            return 'st';
        case 2:
            return 'nd';
        case 3:
            return 'rd';
        default:
            return 'th';
    }
}

export const commonTriggerChecks = {
    startsWith: (triggers, message) => {
        return triggers.some((trigger) => {
            return message.startsWith(trigger);
        });
    },
    endsWith: (triggers, message) => {
        return triggers.some((trigger) => {
            return message.endsWith(trigger);
        });
    },
    includes: (triggers, message) => {
        return triggers.some((trigger) => {
            return message.includes(trigger);
        });
    },
    equals: (triggers, message) => {
        return triggers.some((trigger) => {
            return message === trigger;
        });
    },
};

export function verifyToken(token) {
    return new Promise((resolve, _) => {
        if (!token) {
            resolve(false);
            return;
        }

        axios
            .post('http://localhost:3002/verify', {
                token,
            })
            .then((response) => {
                if (response?.data?.valid === true) {
                    resolve(true);
                    return;
                }

                resolve(false);
                return;
            })
            .catch((error) => {
                console.log(error);
                resolve(false);
                return;
            });
    });
}

export function validJSON(string) {
    try {
        JSON.parse(string);
    } catch (e) {
        return false;
    }
    return true;
}

export function getBody(req) {
    return new Promise((resolve, reject) => {
        if (req.body && Object.keys(req.body).length > 0) {
            resolve(req.body);
            return;
        }

        req.on('data', (data) => {
            const body = data.toString();
            if (validJSON(body)) {
                const parsed = JSON.parse(body);
                resolve(parsed);
                return;
            }

            reject({
                error: 'Invalid JSON.',
                body,
            });
        });

        req.on('error', (error) => {
            reject(error);
            return;
        });

        setTimeout(() => {
            reject({
                error: 'Request timed out.',
            });
            return;
        }, 5000);
    });
}

export function getCircularReplacer() {
    const seen = new WeakSet();
    return (_, value) => {
        if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
                return;
            }
            seen.add(value);
        }
        return value;
    };
}

export function stringifyCircular(circularReference, space = 4) {
    return JSON.stringify(circularReference, getCircularReplacer(), space);
}
