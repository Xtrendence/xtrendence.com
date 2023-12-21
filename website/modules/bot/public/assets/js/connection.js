const ip = window.location.hostname;
const port = window.location.port;

const token = getCookie('token') || localStorage.getItem('token');

const socket = io(ip + ':' + port, {
    path: ip + 'bot/socket.io',
    auth: {
        token,
    },
});
