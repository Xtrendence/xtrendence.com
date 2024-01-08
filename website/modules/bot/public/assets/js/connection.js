const ip = window.location.hostname;
const port = window.location.port;

const token = getCookie('token') || localStorage.getItem('token');

let socket = io(ip + ':' + port, {
    path: '/bot/socket.io',
    auth: {
        token,
    },
});

setInterval(() => {
    if (!socket.connected) {
        socket.connect();
    }
}, 5000);
