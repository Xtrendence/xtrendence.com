// TODO: Add encryption
function sendRequest(url, method, params) {
    let xhr = new XMLHttpRequest();

    return new Promise((resolve, reject) => {
        xhr.addEventListener('readystatechange', () => {
            if (xhr.readyState !== 4) return;
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(xhr.responseText);
            } else {
                reject(xhr.responseText);
            }
        });

        xhr.open(method, url, true);

        if (params?.token) {
            xhr.setRequestHeader('Token', params.token);
        }

        xhr.send(params?.body);
    });
}

function validJSON(string) {
    try {
        JSON.parse(string);
    } catch (e) {
        return false;
    }
    return true;
}
