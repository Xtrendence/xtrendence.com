import { commonTriggerChecks } from '../../utils/utils.js';

export const abilities = [
    {
        name: 'sharing',
        ability: () => 'sharing',
        description: 'Say module name.',
        triggers: ['/sharing'],
        triggerCheck: commonTriggerChecks.equals,
    },
];
