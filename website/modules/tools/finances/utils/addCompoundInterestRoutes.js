import { verifyToken, getBody, generateId } from './utils.js';
import { readFileSync, writeFileSync } from 'fs';

export function addCompoundInterestRoutes(app, files) {
    app.get('/compound-interest', async (req, res) => {
        const token = req.cookies.token;

        const validToken = await verifyToken(token);

        if (!validToken) {
            res.redirect('/error/401');
            return;
        }

        const compoundInterest = JSON.parse(
            readFileSync(files.compoundInterestFile).toString()
        );

        res.status(200).send(compoundInterest);
    });

    app.post('/compound-interest', async (req, res) => {
        const token = req.cookies.token;

        const validToken = await verifyToken(token);

        if (!validToken) {
            res.redirect('/error/401');
            return;
        }

        const body = await getBody(req);

        if (!body.label || !body.yearlyInterest) {
            res.status(400).send();
            return;
        }

        const bodyLabel = body.label.replace(/\-+/g, '-');

        const label =
            bodyLabel.charAt(0) === '-' ? bodyLabel.slice(1) : bodyLabel;

        const compoundInterest = JSON.parse(
            readFileSync(files.compoundInterestFile).toString()
        );

        const id = body.id || generateId();

        if (body.id && bodyLabel.charAt(0) === '-') {
            delete compoundInterest[id];
        } else {
            if (bodyLabel.charAt(0) !== '-') {
                compoundInterest[id] = {
                    ...{
                        label: body.label || 'Unknown',
                        yearlyInterest: body.yearlyInterest || 0,
                        monthlyContribution: body.monthlyContribution || 0,
                    },
                    label,
                };
            }
        }

        writeFileSync(
            files.compoundInterestFile,
            JSON.stringify(compoundInterest)
        );

        res.status(204).send();
    });
}
