import * as conversation from './conversation/conversation.js';

import * as finances from './finances/finances.js';

import * as meta from './meta/meta.js';

import * as events from './planning/events.js';
import * as lists from './planning/lists.js';

import * as server from './server/server.js';

import * as files from './sharing/files.js';
import * as text from './sharing/text.js';

import * as dictionary from './tools/dictionary.js';
import * as downloader from './tools/downloader.js';
import * as lights from './tools/lights.js';
import * as lyrics from './tools/lyrics.js';
import * as weather from './tools/weather.js';

import * as utilities from './utilities/utilities.js';

export const modules = {
    conversation,
    finances,
    meta,
    planning: {
        events,
        lists,
    },
    server,
    sharing: {
        files,
        text,
    },
    tools: {
        dictionary,
        downloader,
        lights,
        lyrics,
        weather,
    },
    utilities,
};
