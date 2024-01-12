const divMessagesWrapper =
    document.getElementsByClassName('messages-wrapper')[0];

function renderMessages() {
    const currentChecksum = divMessagesWrapper.getAttribute('data-checksum');

    if (conversation.checksum !== currentChecksum) {
        divMessagesWrapper.setAttribute('data-checksum', conversation.checksum);
        divMessagesWrapper.innerHTML = '';

        conversation.messages.forEach((message) => {
            const divMessage = document.createElement('div');
            divMessage.setAttribute('id', message.id);
            divMessage.setAttribute('class', `message`);

            if (message.message) {
                const divUserMessageRow = document.createElement('div');
                divUserMessageRow.setAttribute('class', `row user`);

                const divUserMessage = document.createElement('div');
                divUserMessage.setAttribute('class', 'bubble');
                divUserMessage.innerHTML = messageToHtml(message.message);

                divUserMessageRow.appendChild(divUserMessage);
                divMessage.appendChild(divUserMessageRow);
            }

            if (message.response) {
                const divBotMessageRow = document.createElement('div');
                divBotMessageRow.setAttribute('class', `row bot`);

                const divBotMessage = document.createElement('div');
                divBotMessage.setAttribute('class', 'bubble');
                divBotMessage.innerHTML = messageToHtml(message.response);

                divBotMessageRow.appendChild(divBotMessage);
                divMessage.appendChild(divBotMessageRow);
            }

            divMessagesWrapper.appendChild(divMessage);
        });

        divMessagesWrapper.scrollTop = divMessagesWrapper.scrollHeight;
    }
}

setInterval(renderMessages, 100);
