import { commonTriggerChecks } from '../../utils/utils.js';
import { getDate, userBirthday } from './events.js';

export const abilities = [
    {
        name: 'planning',
        ability: () => 'planning',
        description: 'Say module name.',
        triggers: ['/planning'],
        triggerCheck: commonTriggerChecks.equals,
    },
    {
        name: getDate.name,
        ability: getDate,
        description: 'Return the current date.',
        triggers: [
            'date',
            'what is the date',
            'what is today',
            'what day is it',
            'what day is today',
            'what is the date today',
            `what is today's date`,
            '/date',
        ],
        triggerCheck: commonTriggerChecks.equals,
    },
    {
        name: userBirthday.name,
        ability: userBirthday,
        description: `Return the number of days until Adrian's birthday.`,
        triggers: [
            `how many days until adrian's birthday`,
            `how many days until my birthday`,
            `/birthday`,
            `when's adrian's birthday`,
            `when's my birthday`,
            `when is adrian's birthday`,
            `when is my birthday`,
        ],
        triggerCheck: commonTriggerChecks.equals,
    },
];
