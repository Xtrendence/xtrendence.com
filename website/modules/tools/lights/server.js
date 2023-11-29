import express from 'express';
import * as path from 'path';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';
import { getBody, verifyToken } from './utils/utils.js';
import { checkConfig, getConfig, setConfig } from './utils/config.js';
import { sendRequest } from './utils/lights.js';
import { checkKeys } from './utils/keys.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

checkConfig();
checkKeys();

const app = express();

app.use('/tools/lights/', express.static('public'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/tools/lights/:token', (req, res) => {
    const token = req.params.token;
    if (!verifyToken(token, true)) {
        res.status(401).send('Unauthorized');
        return;
    }

    res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.get('/tools/lights/api/lights/config', (req, res) => {
    const token = req.headers.token;
    if (!verifyToken(token, true)) {
        res.status(401).send('Unauthorized');
        return;
    }

    const config = getConfig();
    res.json(config);
});

app.post('/tools/lights/api/lights/config', async (req, res) => {
    const token = req.headers.token;
    if (!verifyToken(token, false)) {
        res.status(401).send('Unauthorized');
        return;
    }

    const { ip, port, guest } = await getBody(req);

    if (!ip || !port || guest === undefined) {
        res.status(400).json({
            error: 'Missing required parameters',
        });

        return;
    }

    setConfig({
        ip,
        port,
        guest,
    });
});

app.get('/tools/lights/api/lights/status', (req, res) => {
    const token = req.headers.token;
    if (!verifyToken(token, true)) {
        res.status(401).send('Unauthorized');
        return;
    }

    sendRequest(
        'get_prop',
        ['power', 'bright', 'rgb', 'color_mode'],
        (data) => {
            res.send(data);
        }
    );
});

app.get('/tools/lights/api/lights/power', (req, res) => {
    const token = req.headers.token;
    if (!verifyToken(token, true)) {
        res.status(401).send('Unauthorized');
        return;
    }

    sendRequest('get_prop', ['power'], (data) => {
        res.send(data);
    });
});

app.post('/tools/lights/api/lights/power', async (req, res) => {
    const token = req.headers.token;
    if (!verifyToken(token, true)) {
        res.status(401).send('Unauthorized');
        return;
    }

    const { power } = await getBody(req);

    if (power === true) {
        sendRequest('set_power', ['on'], (data) => {
            res.send(data);
        });
    } else {
        sendRequest('set_power', ['off'], (data) => {
            res.send(data);
        });
    }
});

app.get('/tools/lights/api/lights/brightness', (req, res) => {
    const token = req.headers.token;
    if (!verifyToken(token, true)) {
        res.status(401).send('Unauthorized');
        return;
    }

    sendRequest('get_prop', ['bright'], (data) => {
        res.send(data);
    });
});

app.post('/tools/lights/api/lights/brightness', async (req, res) => {
    const token = req.headers.token;
    if (!verifyToken(token, true)) {
        res.status(401).send('Unauthorized');
        return;
    }

    const { brightness: brightnessString } = await getBody(req);

    const brightness = parseInt(brightnessString);

    if (brightness >= 1 && brightness <= 100) {
        sendRequest('set_bright', [brightness], (data) => {
            res.send(data);
        });
    } else if (brightness < 1) {
        sendRequest('set_bright', [1], () => {
            sendRequest('set_power', ['off'], (data) => {
                res.send(data);
            });
        });
    }
});

app.get('/tools/lights/api/lights/color', (req, res) => {
    const token = req.headers.token;
    if (!verifyToken(token, true)) {
        res.status(401).send('Unauthorized');
        return;
    }

    sendRequest('get_prop', ['rgb', 'color_mode'], (data) => {
        res.send(data);
    });
});

app.post('/tools/lights/api/lights/color', async (req, res) => {
    const token = req.headers.token;
    if (!verifyToken(token, true)) {
        res.status(401).send('Unauthorized');
        return;
    }

    const { color, mode, brightness: brightnessString } = await getBody(req);
    const brightness = parseInt(brightnessString);

    if (mode == 'color') {
        const colors = {
            orange: 0xffc04c,
            white: 0xffffff,
            purple: 0x660099,
            green: 0x00ff00,
            blue: 0x0000ff,
            red: 0xff0000,
        };

        if (Object.keys(colors).includes(color)) {
            sendRequest('set_rgb', [colors[color]], (data) => {
                res.send(data);
            });
        }
    } else {
        if (brightness >= 1 && brightness <= 100) {
            sendRequest('set_scene', ['ct', 3000, brightness], (data) => {
                res.send(data);
            });
        } else if (brightness < 1) {
            sendRequest('set_scene', ['ct', 3000, 1], () => {
                sendRequest('set_power', ['off'], (data) => {
                    res.send(data);
                });
            });
        }
    }
});

app.listen(3001, () => {
    console.log('Lights server listening on port 3001');
});
