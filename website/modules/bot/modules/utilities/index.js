import { commonTriggerChecks } from '../../utils/utils.js';

export const abilities = [
    {
        name: 'utilities',
        ability: () => 'utilities',
        description: 'Say module name.',
        triggers: ['/utilities'],
        triggerCheck: commonTriggerChecks.equals,
    },
];
