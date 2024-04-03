import { verifyToken, getBody } from './utils.js';
import { readFileSync, writeFileSync } from 'fs';

export function addIncomeRoutes(app, files) {
    app.get('/income', async (req, res) => {
        const token = req.cookies.token;

        const validToken = await verifyToken(token);

        if (!validToken) {
            res.redirect('/error/401');
            return;
        }

        const income =
            JSON.parse(readFileSync(files.incomeFile).toString()) || {};

        const savings =
            JSON.parse(readFileSync(files.savingsFile).toString()) || {};

        const excludeUnpaidIncome = Object.values(savings)?.find(
            (item) => item?.service?.toLowerCase() === 'eui'
        );

        res.status(200).send({
            ...income,
            excludeUnpaidIncome: excludeUnpaidIncome ? true : false,
        });
    });

    app.post('/income', async (req, res) => {
        const token = req.cookies.token;

        const validToken = await verifyToken(token);

        if (!validToken) {
            res.redirect('/error/401');
            return;
        }

        const body = await getBody(req);

        if (!body.yearly) {
            res.status(400).send();
            return;
        }

        const income = {
            yearly: body.yearly || '0',
            saved: body.saved || '0',
        };

        writeFileSync(files.incomeFile, JSON.stringify(income));

        res.status(204).send();
    });
}
