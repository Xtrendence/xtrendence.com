import { commonTriggerChecks } from '../../utils/utils.js';

export const abilities = [
    {
        name: 'tools',
        ability: () => 'tools',
        description: 'Say module name.',
        triggers: ['/tools'],
        triggerCheck: commonTriggerChecks.equals,
    },
];
