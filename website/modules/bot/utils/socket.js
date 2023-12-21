import { Server } from 'socket.io';
import { verifyToken } from './utils.js';

export function createSocket(server) {
    const io = new Server(server, {
        path: '/socket.io',
    });

    io.use(async (socket, next) => {
        console.log(`Authenticating socket: ${socket.id}`);

        const auth = socket?.handshake?.auth;

        if (!auth || !auth.token) {
            socket.disconnect();
            console.log(`Token not found: ${socket.id}`);
            return;
        }

        const { token } = auth;

        const validToken = await verifyToken(token);

        if (!validToken) {
            socket.disconnect();
            console.log(`Invalid token: ${socket.id}`);
            return;
        }

        console.log(`Socket authenticated: ${socket.id}`);

        next();
    });

    io.on('connection', async (socket) => {
        console.log(`Socket connected: ${socket.id}`);

        socket.on('disconnect', () => {
            console.log(`Socket disconnected: ${socket.id}`);
        });
    });

    io.on('disconnect', () => {
        console.log('Socket server disconnected');
    });

    return io;
}
