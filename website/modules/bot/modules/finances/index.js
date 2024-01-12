import { commonTriggerChecks } from '../../utils/utils.js';

export const abilities = [
    {
        name: 'finances',
        ability: () => 'finances',
        description: 'Say module name.',
        triggers: ['/finances'],
        triggerCheck: commonTriggerChecks.equals,
    },
];
