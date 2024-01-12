import { commonTriggerChecks } from '../../utils/utils.js';
import { clearConversation, status } from './meta.js';

export const abilities = [
    {
        name: 'meta',
        ability: () => 'meta',
        description: 'Say module name.',
        triggers: ['/meta'],
        triggerCheck: commonTriggerChecks.equals,
    },
    {
        name: status.name,
        ability: status,
        description: 'Return my status.',
        triggers: [
            'status',
            `what's your status`,
            `what is your status`,
            '/status',
        ],
        triggerCheck: commonTriggerChecks.equals,
    },
    {
        name: clearConversation.name,
        ability: clearConversation,
        description: 'Delete chat history.',
        triggers: [
            '/clear',
            'delete chat history',
            'delete chat',
            'clear chat history',
            'clear chat',
            'clear conversation',
            'delete conversation',
            'clear history',
            'delete history',
            'clear messages',
            'delete messages',
            'forget what we talked about',
            'forget what i said',
            'forget everything',
            'forget about it',
        ],
        triggerCheck: commonTriggerChecks.equals,
    },
];
