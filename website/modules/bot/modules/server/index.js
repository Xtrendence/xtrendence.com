import { commonTriggerChecks } from '../../utils/utils.js';

export const abilities = [
    {
        name: 'server',
        ability: () => 'server',
        description: 'Say module name.',
        triggers: ['/server'],
        triggerCheck: commonTriggerChecks.equals,
    },
];
