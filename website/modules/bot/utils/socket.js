import { Server } from 'socket.io';
import { getFiles, verifyToken } from './utils.js';
import { determineIntent } from './intent.js';
import {
    getLastMessagesByLimit,
    getMessagesBetweenDates,
    saveMessage,
} from './messages.js';
import { hashElement } from 'folder-hash';

const files = getFiles();

const hashOptions = {
    algo: 'sha1',
    encoding: 'hex',
    files: {
        include: ['*.txt'],
    },
};

export function createSocket(server) {
    let hash = '';
    const io = new Server(server);

    function checkHash(triggerRefresh) {
        hashElement(files.messagesFolder, hashOptions).then((hashResult) => {
            const newHash = hashResult.hash;

            if (hash !== newHash) {
                hash = newHash;

                if (triggerRefresh) {
                    io.to('bot').emit('refreshMessages');
                }
            }
        });
    }

    setInterval(() => {
        checkHash(true);
    }, 2500);

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

        socket.join('bot');

        socket.emit('refreshMessages');

        socket.on('message', async (input) => {
            try {
                console.log(`Socket message: ${socket.id}`);

                if (input?.message?.trim() === '') return;

                const processed = determineIntent(input);

                const token = socket?.handshake?.auth?.token;

                const abilityInput = processed?.intent?.input
                    ? { input, token }
                    : { token };

                const response = await processed?.intent?.ability(abilityInput);

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

                checkHash(false);

                io.to('bot').emit('refreshMessages');
            } catch (error) {
                console.log(error);
            }
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

        socket.on('getLastMessagesByLimit', (request) => {
            const limit = request?.limit || 10;

            const messages = getLastMessagesByLimit(limit);

            console.log(`Returning ${messages?.length} message(s)`);

            socket.emit('getLastMessagesByLimit', messages);
        });

        socket.on('disconnect', () => {
            console.log(`Socket disconnected: ${socket.id}`);
            socket.leave('bot');
        });
    });

    io.on('disconnect', () => {
        console.log('Socket server disconnected');
    });

    return io;
}
