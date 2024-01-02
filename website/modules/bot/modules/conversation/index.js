import { commonTriggerChecks } from '../../utils/utils.js';
import { greet } from './conversation.js';

export const abilities = [
    {
        name: 'conversation',
        ability: () => 'conversation',
        description: 'Say module name.',
        triggers: ['/conversation'],
        triggerCheck: commonTriggerChecks.equals,
    },
    {
        name: greet.name,
        ability: greet,
        description: 'Greet the user.',
        triggers: ['hello', 'hi', 'hey'],
        triggerCheck: commonTriggerChecks.equals,
    },
];
