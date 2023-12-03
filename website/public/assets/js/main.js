const devMode = true;

if (
    window.location.hostname.includes('xtrendence.com') &&
    !window.location.href.includes('https')
) {
    window.location.href = window.location.href.replace('http', 'https');
}
