import { verifyToken, getBody, generateId } from './utils.js';
import { readFileSync, writeFileSync } from 'fs';

export function addSavingsRoutes(app, files) {
    app.get('/savings', async (req, res) => {
        const token = req.cookies.token;

        const validToken = await verifyToken(token);

        if (!validToken) {
            res.redirect('/error/401');
            return;
        }

        const savings = JSON.parse(readFileSync(files.savingsFile).toString());

        res.status(200).send(savings);
    });

    app.post('/savings', async (req, res) => {
        const token = req.cookies.token;

        const validToken = await verifyToken(token);

        if (!validToken) {
            res.redirect('/error/401');
            return;
        }

        const body = await getBody(req);

        if (!body.service || !body.amount) {
            res.status(400).send();
            return;
        }

        const bodyService = body.service.replace(/\-+/g, '-');

        const service =
            bodyService.charAt(0) === '-' ? bodyService.slice(1) : bodyService;

        const savings = JSON.parse(readFileSync(files.savingsFile).toString());

        const id = body.id || generateId();

        let existingId;

        for (let i = 0; i < Object.keys(savings).length; i++) {
            const savingId = Object.keys(savings)[i];

            if (
                savings[savingId]?.service?.toLowerCase() ===
                service.toLowerCase()
            ) {
                existingId = savingId;
                delete savings[savingId];
            }
        }

        if (existingId && bodyService.charAt(0) === '-') {
            delete savings[id];
            delete savings[existingId];
        } else {
            if (bodyService.charAt(0) !== '-') {
                savings[id] = {
                    ...{
                        amount: body.amount || 0,
                        aer: body.aer || 0,
                    },
                    service,
                };
            }
        }

        writeFileSync(files.savingsFile, JSON.stringify(savings));

        res.status(204).send();
    });
}
