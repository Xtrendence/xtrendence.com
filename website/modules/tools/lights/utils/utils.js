import { getConfig } from './config.js';
import { validKey } from './keys.js';

export function verifyToken(token, allowGuest = false) {
    const config = getConfig();

    if (allowGuest && config.guest === true) {
        return validKey(token, 'admin') || validKey(token, 'guest');
    }

    return validKey(token, 'admin');
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
                error: 'Invalid JSON',
                body,
            });
        });

        req.on('error', (error) => {
            reject(error);
            return;
        });

        setTimeout(() => {
            reject({
                error: 'Request timed out',
            });
            return;
        }, 5000);
    });
}
