let conversationDate = new Date();
let conversationDateString = conversationDate.toISOString().split('T')[0];

const conversation = {
    messages: [],
    total: 0,
    checksum: '',
    limit: 10,
    scroll: true,
    previousFirstMessage: null,
};

socket.on('getLastMessagesByLimit', (response) => {
    conversation.messages = sortMessages(response.messages);
    conversation.total = response.total;
    conversation.checksum = sha256(JSON.stringify(response));
});

socket.on('refreshMessages', () => {
    getLastMessagesByLimit(conversation.limit);
});

function getLastMessagesByLimit(limit) {
    socket.emit('getLastMessagesByLimit', {
        limit,
    });
}
