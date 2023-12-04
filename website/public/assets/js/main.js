const devMode = true;

if (
    window.location.hostname.includes('xtrendence.com') &&
    !window.location.href.includes('https') &&
    !['vpn', 'ftp', 'apt'].includes(window.location.hostname.split('.')[0])
) {
    window.location.href = window.location.href.replace('http', 'https');
}
