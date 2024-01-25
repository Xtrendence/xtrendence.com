// TODO: Add encryption
function sendRequest(method, url, body) {
    const loading = document.getElementById('loading');

    loading.classList.remove('hidden');

    let xhr = new XMLHttpRequest();

    return new Promise((resolve, reject) => {
        xhr.addEventListener('readystatechange', () => {
            setTimeout(() => {
                loading.classList.add('hidden');
            }, 250);

            if (xhr.readyState !== 4) return;
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(xhr.responseText);
            } else {
                reject();
            }
        });

        xhr.open(method, url, true);
        xhr.send(body);
    });
}
