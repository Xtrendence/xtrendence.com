let conversationDate = new Date();
let conversationDateString = conversationDate.toISOString().split('T')[0];

const conversation = {
    messages: [],
    checksum: '',
};

socket.on('getMessages', (response) => {
    conversation.messages = response;
    conversation.checksum = sha256(JSON.stringify(response));
});

socket.on('refreshMessages', () => {
    getMessages(conversationDateString, conversationDateString);
});

function getMessages(fromDate, toDate) {
    socket.emit('getMessages', {
        fromDate,
        toDate,
    });
}
