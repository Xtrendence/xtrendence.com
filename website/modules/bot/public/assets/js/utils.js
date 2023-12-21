function getCookie(cookie) {
    try {
        const name = cookie + '=';
        const decodedCookie = decodeURIComponent(document.cookie);
        const parts = decodedCookie.split(';');

        for (let i = 0; i < parts.length; i++) {
            let value = parts[i];

            while (value.charAt(0) === ' ') {
                value = value.substring(1);
            }

            if (value.indexOf(name) === 0) {
                return value.substring(name.length, value.length);
            }
        }

        return '';
    } catch (e) {
        return '';
    }
}
