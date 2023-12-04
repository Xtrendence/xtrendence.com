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
