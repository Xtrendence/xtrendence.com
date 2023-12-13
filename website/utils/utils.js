import axios from 'axios';

export function verifyToken(token) {
    return new Promise((resolve, _) => {
        if (!token) {
            resolve(false);
            return;
        }

        axios
            .post('http://localhost:3002/auth/verify', {
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

export function logout(token) {
    return new Promise((resolve, _) => {
        if (!token) {
            resolve(false);
            return;
        }

        axios
            .post('http://localhost:3002/auth/logout', {
                token,
            })
            .then((response) => {
                if (response?.data?.success === true) {
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

export function serverOutput(port) {
    console.log(
        '\n\n\x1b[35m%s\x1b[0m',
        `----------------------------------------`
    );

    console.log('\x1b[35m%s\x1b[0m', `Server listening on port ${port}`);

    console.log(
        '\x1b[35m%s\x1b[0m',
        `----------------------------------------`
    );

    console.log(`Shortcuts:`);
    console.log('\x1b[34m%s\x1b[0m', `http://xtrendence.com`);
    console.log('\x1b[34m%s\x1b[0m', `http://localhost:${port}`);
    console.log('\x1b[34m%s\x1b[0m', `http://192.168.1.50:${port}`);
    console.log('\x1b[34m%s\x1b[0m', `http://192.168.1.95:${port}`);
}
