import { modules } from '../modules/index.js';

export function determineIntent(data) {
    try {
        const { message } = data;

        const sanitizedMessage = message.toLowerCase().trim();

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

        console.log('I should:', intent.description);

        return intent;
    } catch (error) {
        console.log(error);
    }
}
