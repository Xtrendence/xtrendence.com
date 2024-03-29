import { commonTriggerChecks } from '../../utils/utils.js';
import {
    activities,
    agree,
    badBot,
    bye,
    flipCoin,
    greet,
    happy,
    inclusiveOr,
    meet,
    riley,
    thanked,
    what,
    worried,
} from './conversation.js';

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
        triggers: [
            'hello',
            'hi',
            'hey',
            'hola',
            'greetings',
            'good morning',
            'good afternoon',
            'good evening',
            'good day',
            'yellow',
            'yo',
            'sup',
        ],
        triggerCheck: commonTriggerChecks.equals,
    },
    {
        name: flipCoin.name,
        ability: flipCoin,
        description: 'Flip a coin.',
        triggers: ['flip a coin', 'flip coin', 'coin flip'],
        triggerCheck: commonTriggerChecks.equals,
    },
    {
        name: thanked.name,
        ability: thanked,
        description: 'Respond to a thank you.',
        triggers: [
            'thank you',
            'thanks',
            'thank you very much',
            'thanks a lot',
            'thanks a bunch',
            'much appreciated',
            'much obliged',
        ],
        triggerCheck: commonTriggerChecks.equals,
    },
    {
        name: bye.name,
        ability: bye,
        description: 'Say goodbye.',
        triggers: [
            'bye',
            'goodbye',
            'see you later',
            'see you soon',
            'bye bye',
            'good bye',
            'talk to you later',
            'catch you later',
            'later',
            'talk soon',
        ],
        triggerCheck: commonTriggerChecks.equals,
    },
    {
        name: happy.name,
        ability: happy,
        description: 'Say how happy I am.',
        triggers: ['how happy are you', 'are you happy'],
        triggerCheck: commonTriggerChecks.equals,
    },
    {
        name: worried.name,
        ability: worried,
        description: `Say I'm okay.`,
        triggers: ['i was worried about you'],
        triggerCheck: commonTriggerChecks.equals,
    },
    {
        name: meet.name,
        ability: meet,
        description: 'Say it was nice to meet the user.',
        triggers: ['nice to meet you', 'it was nice to meet you'],
        triggerCheck: commonTriggerChecks.equals,
    },
    {
        name: badBot.name,
        ability: badBot,
        description: 'User is wrong.',
        triggers: ['bad bot', `you're a bad bot`, `you are a bad bot`],
        triggerCheck: commonTriggerChecks.equals,
    },
    {
        name: riley.name,
        ability: riley,
        description: `Say I'm at the user's service.`,
        triggers: ['riley'],
        triggerCheck: commonTriggerChecks.equals,
    },
    {
        name: agree.name,
        ability: agree,
        description: `Agree with the user.`,
        triggers: [
            'am i right',
            'back me up',
            'do you agree',
            'do you concur',
            'am i wrong',
        ],
        triggerCheck: commonTriggerChecks.equals,
    },
    {
        name: activities.name,
        ability: activities,
        description: 'Say what I do.',
        triggers: [
            'what do you do',
            'what are you doing',
            'what are you up to',
            'what do you like to do',
            'what do you like doing',
            'what do you do for fun',
        ],
        triggerCheck: commonTriggerChecks.equals,
    },
    {
        name: inclusiveOr.name,
        ability: inclusiveOr,
        description: 'Say yes.',
        triggers: [
            'do you prefer',
            'which do you prefer',
            'which is better',
            'which one',
            'which is your favorite',
            'which is your favourite',
            'which one do you like',
            'which one do you prefer',
            'which one is better',
            'which one is your favorite',
            'which one is your favourite',
            `what's your favorite`,
            `what's your favourite`,
            'what is your favorite',
            'what is your favourite',
        ],
        triggerCheck: commonTriggerChecks.includes,
    },
    {
        name: what.name,
        ability: what,
        description: 'Say that the user heard me.',
        triggers: ['what'],
        triggerCheck: commonTriggerChecks.equals,
    },
];
