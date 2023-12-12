import { verifyToken, getBody, generateId } from './utils.js';
import { readFileSync, writeFileSync } from 'fs';

export function addOwedRoutes(app, files) {
    app.get('/tools/finances/owed', async (req, res) => {
        const token = req.cookies.token;

        const validToken = await verifyToken(token);

        if (!validToken) {
            res.redirect('/error/401');
            return;
        }

        const owed = JSON.parse(readFileSync(files.owedFile).toString());

        res.status(200).send(owed);
    });

    app.post('/tools/finances/owed', async (req, res) => {
        const token = req.cookies.token;

        const validToken = await verifyToken(token);

        if (!validToken) {
            res.redirect('/error/401');
            return;
        }

        const body = await getBody(req);

        if (!body.name || !body.owes) {
            res.status(400).send();
            return;
        }

        const bodyName = body.name.replace(/\-+/g, '-');

        const name = bodyName.charAt(0) === '-' ? bodyName.slice(1) : bodyName;

        const owed = JSON.parse(readFileSync(files.owedFile).toString());

        const id = body.id || generateId();

        if (body.id && bodyName.charAt(0) === '-') {
            delete owed[id];
        } else {
            if (bodyName.charAt(0) !== '-') {
                owed[id] = {
                    ...{
                        name: body.name || 'Unknown',
                        owes: body.owes || 0,
                        reason: body.reason || 'Unknown',
                    },
                    name,
                };
            }
        }

        writeFileSync(files.owedFile, JSON.stringify(owed));

        res.status(204).send();
    });
}
