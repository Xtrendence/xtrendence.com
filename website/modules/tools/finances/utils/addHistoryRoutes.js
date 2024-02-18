import { readdirSync, readFileSync } from 'fs';

export function addHistoryRoutes(app, folder) {
    app.get('/history', async (req, res) => {
        const start = req.query.start;
        const end = req.query.end;

        console.log(start, end);

        if (!start || !end) {
            res.status(400).send({
                error: 'Invalid date range',
            });
            return;
        }

        const startDate = new Date(start);
        const endDate = new Date(end);

        const files = readdirSync(folder);
        const history = [];
        for (const file of files) {
            const date = new Date(file.split('.')[0]);
            if (date >= startDate && date <= endDate) {
                const data = JSON.parse(
                    readFileSync(`${folder}/${file}`).toString()
                );

                history.push(data);
            }
        }

        res.status(200).send(history);
    });
}
