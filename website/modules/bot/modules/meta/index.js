import { commonTriggerChecks } from '../../utils/utils.js';

export const abilities = [
    {
        name: 'meta',
        ability: () => 'meta',
        description: 'Say module name.',
        triggers: ['/meta'],
        triggerCheck: commonTriggerChecks.equals,
    },
];
