import { getFiles, validJSON } from './utils.js';
import fs from 'fs';
import crypto from 'crypto';

const files = getFiles();

export function getMessageFiles() {
    return fs
        .readdirSync(files.messagesFolder)
        .sort((a, b) => new Date(a.split('.')[0]) - new Date(b.split('.')[0]));
}

export function sortMessages(messages) {
    if (!messages) return;

    return messages.sort((a, b) => {
        const aTimestamp = Number(a.id.split('-')[0]);
        const bTimestamp = Number(b.id.split('-')[0]);
        return new Date(aTimestamp).getTime() - new Date(bTimestamp).getTime();
    });
}

export function getTotalMessages() {
    const messageFiles = getMessageFiles();
    let total = 0;

    messageFiles.forEach((messageFile) => {
        const filename = messageFile.split('.')[0];
        const content = getMessagesByDate(filename);
        total += content.length;
    });

    return total;
}

export function getMessagesByDate(date) {
    if (!date) return;

    const file = `${files.messagesFolder}/${date}.txt`;

    if (fs.existsSync(file)) {
        const json = fs.readFileSync(file, 'utf8');

        if (validJSON(json)) {
            const messages = JSON.parse(json);
            return sortMessages(messages);
        }

        fs.writeFileSync(file, JSON.stringify([]));
        return [];
    }

    return [];
}

export function getMessagesBetweenDates(fromDate, toDate) {
    if (!fromDate || !toDate) return;

    let messages = [];

    const messageFiles = getMessageFiles();

    messageFiles.forEach((messageFile) => {
        const filename = messageFile.split('.')[0];
        const date = new Date(filename);

        if (date >= new Date(fromDate) && date <= new Date(toDate)) {
            const content = getMessagesByDate(filename);
            messages = [...messages, ...content];
        }
    });

    return {
        messages: sortMessages(messages),
        total: getTotalMessages(),
    };
}

export function getMessage(id) {
    if (!id) return;

    const timestamp = Number(id.split('-')[0]);
    const date = new Date(timestamp);
    const messages = getMessagesByDate(date);
    return messages.find((message) => message.id === id);
}

export function getPreviousMessage() {
    const messageFiles = getMessageFiles();
    const lastMessageFile = messageFiles[messageFiles?.length - 1];
    const date = lastMessageFile.split('.')[0];
    const lastMessages = getMessagesByDate(date);

    if (lastMessages.length === 0) return null;

    return lastMessages[lastMessages?.length - 1];
}

export function getLastMessagesByLimit(limit = 20) {
    const messages = [];
    const messageFiles = getMessageFiles();

    for (let i = messageFiles.length - 1; i >= 0; i--) {
        const file = messageFiles[i];
        const date = file.split('.')[0];
        const content = getMessagesByDate(date);

        if (content.length > 0) {
            for (let j = content.length - 1; j >= 0; j--) {
                messages.push(content[j]);

                if (messages.length >= limit) {
                    break;
                }
            }
        }

        if (messages.length >= limit) {
            break;
        }
    }

    return {
        messages: sortMessages(messages),
        total: getTotalMessages(),
    };
}

export function saveMessage(message) {
    if (!message) return;

    const current = new Date();
    const date = current.toISOString().split('T')[0];
    const file = `${files.messagesFolder}/${date}.txt`;

    const hex = crypto.randomBytes(4).toString('hex');
    const id = `${current.getTime()}-${hex}`;

    message.id = id;

    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify([message]));
        return;
    }

    const messages = getMessagesByDate(date);

    fs.writeFileSync(file, JSON.stringify([...messages, message]));
}

export function deleteMessage(id) {
    if (!id) return;

    console.log(id);

    const timestamp = Number(id.split('-')[0]);
    const parsed = new Date(timestamp);
    const date = parsed.toISOString().split('T')[0];
    const messages = getMessagesByDate(date);
    const filtered = messages.filter((message) => message.id !== id);

    if (filtered.length === 0) {
        fs.unlinkSync(`${files.messagesFolder}/${date}.txt`);
        return;
    }

    const file = `${files.messagesFolder}/${date}.txt`;
    fs.writeFileSync(file, JSON.stringify(filtered));
}

export function deleteMessages() {
    const messageFiles = getMessageFiles();

    messageFiles.forEach((messageFile) => {
        const filename = messageFile.split('.')[0];
        const file = `${files.messagesFolder}/${filename}.txt`;
        fs.unlinkSync(file);
    });
}

export function updateMessage(id, message) {
    if (!id) return;

    const timestamp = Number(id.split('-')[0]);
    const parsed = new Date(timestamp);
    const date = parsed.toISOString().split('T')[0];
    const messages = getMessagesByDate(date);
    const filtered = messages.filter((message) => message.id !== id);
    const file = `${files.messagesFolder}/${date}.txt`;
    fs.writeFileSync(file, JSON.stringify([...filtered, message]));
}
