const divMessagesWrapper =
    document.getElementsByClassName('messages-wrapper')[0];

divMessagesWrapper.addEventListener('scroll', () => {
    conversation.scroll = true;

    if (divMessagesWrapper.scrollTop === 0) {
        let newLimit = conversation.limit + 10;

        if (newLimit > conversation.total) {
            newLimit = conversation.total;
        }

        conversation.limit = newLimit;
        conversation.scroll = false;
        conversation.previousFirstMessage = conversation.messages[0].id;

        getLastMessagesByLimit(newLimit);
    }
});

function renderMessages() {
    const currentChecksum = divMessagesWrapper.getAttribute('data-checksum');

    if (conversation.checksum !== currentChecksum) {
        divMessagesWrapper.setAttribute('data-checksum', conversation.checksum);
        divMessagesWrapper.innerHTML = '';

        conversation.messages.forEach((message) => {
            const divMessage = document.createElement('div');
            divMessage.setAttribute('id', message.id);
            divMessage.setAttribute('class', `message noselect`);

            divMessage.addEventListener('click', () => {
                document.body.setAttribute(
                    'data-message',
                    btoa(encodeURIComponent(JSON.stringify(message)))
                );

                document.body.classList.add('message-menu');
            });

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

        if (conversation.scroll) {
            divMessagesWrapper.scrollTop = divMessagesWrapper.scrollHeight;
        }

        if (conversation.previousFirstMessage) {
            const previousFirstMessage = document.getElementById(
                conversation.previousFirstMessage
            );

            divMessagesWrapper.scrollTop = previousFirstMessage.offsetTop;
        }
    }
}

setInterval(renderMessages, 100);
