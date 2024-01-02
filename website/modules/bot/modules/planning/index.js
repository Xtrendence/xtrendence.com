import { commonTriggerChecks } from '../../utils/utils.js';

export const abilities = [
    {
        name: 'planning',
        ability: () => 'planning',
        description: 'Say module name.',
        triggers: ['/planning'],
        triggerCheck: commonTriggerChecks.equals,
    },
];
