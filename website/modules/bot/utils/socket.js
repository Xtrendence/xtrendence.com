import { Server } from 'socket.io';
import { verifyToken } from './utils.js';
import { determineIntent } from './intent.js';
import { getMessagesBetweenDates, saveMessage } from './messages.js';

export function createSocket(server) {
    const io = new Server(server);

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

        console.log(
            `Token: ${token.substring(0, 4)}...${token.substring(
                token.length - 4
            )}`
        );

        next();
    });

    io.on('connection', async (socket) => {
        console.log(`Socket connected: ${socket.id}`);

        socket.emit('refreshMessages');

        socket.on('message', async (input) => {
            console.log(`Socket message: ${socket.id}`);

            const processed = determineIntent(input);

            const response = await processed?.intent?.ability(
                processed?.intent?.input ? input : undefined
            );

            const data = {
                message: processed?.message,
                sanitizedMessage: processed?.sanitizedMessage,
                response,
                intent: {
                    name: processed?.intent?.name,
                    description: processed?.intent?.description,
                },
            };

            if (response?.callback) {
                response.callback({ socket, data });
                return;
            }

            socket.emit('message', response);

            saveMessage(data);

            socket.emit('refreshMessages');
        });

        socket.on('getMessages', (request) => {
            const fromDate = request?.fromDate;
            const toDate = request?.toDate;

            const messages = getMessagesBetweenDates(fromDate, toDate);

            console.log(
                `Returning ${messages.length} message(s) between ${fromDate} and ${toDate}`
            );

            socket.emit('getMessages', messages);
        });

        socket.on('disconnect', () => {
            console.log(`Socket disconnected: ${socket.id}`);
        });
    });

    io.on('disconnect', () => {
        console.log('Socket server disconnected');
    });

    return io;
}
