if (devMode) {
    const scripts = document.getElementsByTagName('script');
    const links = document.getElementsByTagName('link');
    const images = document.getElementsByTagName('img');

    for (let i = 0; i < scripts.length; i++) {
        const src = scripts[i].getAttribute('src');
        if (src) {
            scripts[i].setAttribute('src', src + '?v=' + Date.now());
        }
    }

    for (let i = 0; i < links.length; i++) {
        const href = links[i].getAttribute('href');
        if (href) {
            links[i].setAttribute('href', href + '?v=' + Date.now());
        }
    }

    for (let i = 0; i < images.length; i++) {
        const src = images[i].getAttribute('src');
        if (src) {
            images[i].setAttribute('src', src + '?v=' + Date.now());
        }
    }
}
