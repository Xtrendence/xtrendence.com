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
