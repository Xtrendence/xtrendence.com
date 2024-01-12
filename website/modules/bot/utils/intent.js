import { modules } from '../modules/index.js';
import { sanitizeMessage } from './utils.js';

export function determineIntent(data) {
    try {
        const { message } = data;

        const sanitizedMessage = sanitizeMessage(message);

        console.log('Determining intent for message:', message);
        console.log('Sanitized message:', sanitizedMessage);

        let intent;

        const moduleNames = Object.keys(modules);
        moduleNames.forEach((moduleName) => {
            const module = modules[moduleName];

            const abilities = module.abilities;

            abilities.forEach((ability) => {
                const { triggers, triggerCheck } = ability;

                if (triggerCheck(triggers, sanitizedMessage)) {
                    intent = ability;
                }
            });
        });

        console.log('I should:', intent?.description || 'Do nothing.');

        return {
            intent: intent || undefined,
            message,
            sanitizedMessage,
        };
    } catch (error) {
        console.log(error);
    }
}
