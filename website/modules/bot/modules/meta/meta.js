import { deleteMessages } from '../../utils/messages.js';

export function status() {
    const status = [
        'At your service.',
        'Functioning.',
        "I'm okay.",
        'Up and running.',
        'Online.',
    ];
    return status[Math.floor(Math.random() * status.length)];
}

export function clearConversation() {
    deleteMessages();

    return {
        callback: ({ socket }) => socket.emit('refreshMessages'),
    };
}
