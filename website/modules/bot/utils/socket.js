import { Server } from 'socket.io';
import { getFiles, verifyToken } from './utils.js';
import { determineIntent } from './intent.js';
import {
    deleteMessage,
    getLastMessagesByLimit,
    getMessagesBetweenDates,
    saveMessage,
} from './messages.js';
import { hashElement } from 'folder-hash';
import gradient from 'gradient-string';

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
        console.log(
            gradient('beige', 'bisque')(`Authenticating socket: ${socket.id}`)
        );

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

        console.log(
            gradient('gold', 'yellow')(`Socket authenticated: ${socket.id}`)
        );

        console.log(
            gradient(
                'plum',
                'pink'
            )(
                `Token: ${token.substring(0, 4)}...${token.substring(
                    token.length - 4
                )}`
            )
        );

        next();
    });

    io.on('connection', async (socket) => {
        console.log(
            gradient(
                'paleGreen',
                'lightGreen'
            )(`Socket connected: ${socket.id}`)
        );

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

        socket.on('deleteMessage', (request) => {
            const messageId = request?.messageId;

            deleteMessage(messageId);

            console.log(`Deleting message ${messageId}.`);

            io.to('bot').emit('refreshMessages');
        });

        socket.on('getMessages', (request) => {
            const fromDate = request?.fromDate;
            const toDate = request?.toDate;

            const data = getMessagesBetweenDates(fromDate, toDate);

            console.log(
                `Returning ${data.messages.length} message(s) between ${fromDate} and ${toDate}. Total: ${data.total}`
            );

            socket.emit('getMessages', data);
        });

        socket.on('getLastMessagesByLimit', (request) => {
            const limit = request?.limit || 10;

            const data = getLastMessagesByLimit(limit);

            console.log(
                gradient(
                    'mistyrose',
                    'peachpuff'
                )(
                    `Returning ${data.messages?.length} message(s). Total: ${data.total}`
                )
            );

            socket.emit('getLastMessagesByLimit', data);
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
