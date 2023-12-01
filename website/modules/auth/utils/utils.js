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
