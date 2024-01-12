export function greet() {
    const greetings = [
        'Hello!',
        'Hi!',
        'Hey!',
        'Hi there!',
        'Hello there!',
        'Hey there!',
    ];

    return greetings[Math.floor(Math.random() * greetings.length)];
}

export function flipCoin() {
    const coin = ['Heads.', 'Tails.'];
    return coin[Math.floor(Math.random() * coin.length)];
}

export function thanked() {
    const responses = [
        'You are welcome.',
        'No problem.',
        'Anytime.',
        'My pleasure.',
        'No worries.',
        'Of course.',
    ];

    return responses[Math.floor(Math.random() * responses.length)];
}

export function bye() {
    const responses = [
        'Goodbye.',
        'Bye.',
        'See you later.',
        'See you soon.',
        'Later.',
    ];

    return responses[Math.floor(Math.random() * responses.length)];
}

export function happy() {
    return `I'm a bot, so on a scale of 1 to 0, I'd say that's a 1.`;
}

export function worried() {
    return `I'm okay, I promise.`;
}

export function meet() {
    return 'Likewise.';
}

export function badBot() {
    return 'Ding dong, your opinion is wrong.';
}

export function riley() {
    return 'At your service.';
}

export function agree() {
    return `I've been studying this for seconds now, and I agree. Based on my calculations, you're absolutely right.`;
}

export function activities() {
    return 'I mostly just sit around and wait for people to talk to me.';
}

export function inclusiveOr() {
    return 'Yes.';
}

export function what() {
    return 'You heard me.';
}
