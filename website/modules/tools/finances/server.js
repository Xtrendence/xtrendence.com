import express from 'express';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { generateId, validJSON, verifyToken, getBody } from './utils/utils.js';
import cookieParser from 'cookie-parser';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import yahooFinance from 'yahoo-finance2';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const searchInterval = 86400000;
const priceInterval = 3600000;
const priceDelay = 1200000;

const dataDirectory = path.join(__dirname, 'data');

const searchesFile = path.join(__dirname, 'data/searches.db');
const pricesFile = path.join(__dirname, 'data/prices.db');

const savingsFile = path.join(__dirname, 'data/savings.db');
const assetsFile = path.join(__dirname, 'data/assets.db');
const incomeFile = path.join(__dirname, 'data/income.db');
const owedFile = path.join(__dirname, 'data/owed.db');

if (!existsSync(dataDirectory)) {
    mkdirSync(dataDirectory);
}

for (const file of [
    searchesFile,
    pricesFile,
    savingsFile,
    assetsFile,
    incomeFile,
    owedFile,
]) {
    if (!existsSync(file) || !validJSON(readFileSync(file).toString())) {
        writeFileSync(file, JSON.stringify({}));
    }
}

refreshPrices();

const app = express();

app.use(cors({ origin: '*' }));

app.use(cookieParser());

app.use('/tools/finances/assets', express.static('public/assets'));

app.get('/tools/finances', async (req, res) => {
    const token = req.cookies.token;

    const validToken = await verifyToken(token);

    if (!validToken) {
        res.redirect('/error/401');
        return;
    }

    res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.get('/tools/finances/savings', async (req, res) => {
    const token = req.cookies.token;

    const validToken = await verifyToken(token);

    if (!validToken) {
        res.redirect('/error/401');
        return;
    }

    const savings = JSON.parse(readFileSync(savingsFile).toString());

    res.status(200).send(savings);
});

app.post('/tools/finances/savings', async (req, res) => {
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

    const savings = JSON.parse(readFileSync(savingsFile).toString());

    const id = body.id || generateId();

    let existingId;

    for (let i = 0; i < Object.keys(savings).length; i++) {
        const savingId = Object.keys(savings)[i];

        if (
            savings[savingId]?.service?.toLowerCase() === service.toLowerCase()
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

    writeFileSync(savingsFile, JSON.stringify(savings));

    res.status(204).send();
});

app.get('/tools/finances/prices', async (req, res) => {
    const token = req.cookies.token;

    const validToken = await verifyToken(token);

    if (!validToken) {
        res.redirect('/error/401');
        return;
    }

    const prices = JSON.parse(readFileSync(pricesFile).toString());

    res.status(200).send(prices);
});

app.get('/tools/finances/assets/:asset', async (req, res) => {
    try {
        const token = req.cookies.token;

        const validToken = await verifyToken(token);

        if (!validToken) {
            res.redirect('/error/401');
            return;
        }

        const bodyAsset = req.params.asset.replace(/\-+/g, '-');
        const asset =
            bodyAsset.charAt(0) === '-' ? bodyAsset.slice(1) : bodyAsset;

        const searches = JSON.parse(readFileSync(searchesFile).toString());

        // Limit to 1 search per day for each asset. New crypto and stocks are unlikely to be added or removed that often.
        if (
            searches[asset.toLocaleLowerCase()] &&
            searches[asset.toLowerCase()].fetched + searchInterval > Date.now()
        ) {
            res.status(200).send(searches[asset.toLowerCase()]);
            return;
        }

        console.log(`Fetching ${asset} from Yahoo Finance...`);

        const response = await yahooFinance.search(asset);

        if (response) {
            searches[asset.toLowerCase()] = {
                ...response,
                fetched: Date.now(),
            };

            writeFileSync(searchesFile, JSON.stringify(searches, null, 4));

            res.status(200).send(response);
        }
    } catch (error) {
        console.log(error);
    }
});

app.get('/tools/finances/assets', async (req, res) => {
    const token = req.cookies.token;

    const validToken = await verifyToken(token);

    if (!validToken) {
        res.redirect('/error/401');
        return;
    }

    const assets = JSON.parse(readFileSync(assetsFile).toString());

    res.status(200).send(assets);
});

app.post('/tools/finances/assets', async (req, res) => {
    const token = req.cookies.token;

    const validToken = await verifyToken(token);

    if (!validToken) {
        res.redirect('/error/401');
        return;
    }

    const body = await getBody(req);

    if (!body.asset) {
        res.status(400).send();
        return;
    }

    const bodyAsset = body.asset.replace(/\-+/g, '-');

    const asset = bodyAsset.charAt(0) === '-' ? bodyAsset.slice(1) : bodyAsset;

    const assets = JSON.parse(readFileSync(assetsFile).toString());

    if (!assets['gbp=x']) {
        assets['gbp=x'] = {
            amount: 1,
            asset: 'GBP=X',
        };
    }

    const id = body.id || generateId();

    let existingId;

    for (let i = 0; i < Object.keys(assets).length; i++) {
        const assetId = Object.keys(assets)[i];

        if (assets[assetId]?.asset?.toLowerCase() === asset.toLowerCase()) {
            existingId = assetId;
            delete assets[assetId];
        }
    }

    if (existingId && bodyAsset.charAt(0) === '-') {
        delete assets[id];
        delete assets[existingId];
    } else {
        if (bodyAsset.charAt(0) !== '-') {
            assets[id] = {
                ...{
                    amount: body.amount || 0,
                },
                asset,
            };

            try {
                const prices = JSON.parse(readFileSync(pricesFile).toString());

                if (!prices['lastFetched']) {
                    prices['lastFetched'] = 0;
                }

                // Limit to 1 price fetch per hour for each asset, with a 20 minute delay between each asset.
                if (
                    !prices[asset.toLowerCase()] ||
                    (prices[asset.toLowerCase()].fetched + priceInterval <
                        Date.now() &&
                        prices['lastFetched'] + priceDelay < Date.now())
                ) {
                    console.log(`Fetching ${asset} from Yahoo Finance...`);

                    prices['lastFetched'] = Date.now();
                    const response = await yahooFinance.quote(asset);

                    if (response) {
                        prices[asset.toLowerCase()] = {
                            ...response,
                            fetched: Date.now(),
                        };

                        writeFileSync(
                            pricesFile,
                            JSON.stringify(prices, null, 4)
                        );
                    }
                }
            } catch (error) {
                console.log(error);
            }
        }
    }

    writeFileSync(assetsFile, JSON.stringify(assets));

    res.status(204).send();
});

async function refreshPrices() {
    try {
        const assets = JSON.parse(readFileSync(assetsFile).toString());
        const prices = JSON.parse(readFileSync(pricesFile).toString());

        if (!prices['lastFetched']) {
            prices['lastFetched'] = 0;
        }

        const symbols = Object.keys(assets);
        for (let i = 0; i < Object.keys(prices).length; i++) {
            for (let j = 0; j < symbols.length; j++) {
                if (!prices[symbols[j]]) {
                    prices[symbols[j]] = {
                        fetched: 0,
                    };
                }
            }
        }

        const sortedPrices = Object.keys(prices).sort(
            (a, b) => prices[a].fetched - prices[b].fetched
        );

        for (let i = 0; i < sortedPrices.length; i++) {
            if (
                prices[sortedPrices[i]].fetched + priceInterval < Date.now() &&
                prices['lastFetched'] + priceDelay < Date.now()
            ) {
                console.log(
                    `Fetching ${sortedPrices[i]} from Yahoo Finance...`
                );

                prices['lastFetched'] = Date.now();
                const response = await yahooFinance.quote(sortedPrices[i]);

                if (response) {
                    prices[sortedPrices[i]] = {
                        ...response,
                        fetched: Date.now(),
                    };

                    writeFileSync(pricesFile, JSON.stringify(prices, null, 4));
                }
            }
        }
    } catch (error) {
        console.log(error);
    }
}

setInterval(() => {
    refreshPrices();
}, priceDelay);

app.get('/tools/finances/income', async (req, res) => {
    const token = req.cookies.token;

    const validToken = await verifyToken(token);

    if (!validToken) {
        res.redirect('/error/401');
        return;
    }

    const income = JSON.parse(readFileSync(incomeFile).toString());

    res.status(200).send(income);
});

app.post('/tools/finances/income', async (req, res) => {
    const token = req.cookies.token;

    const validToken = await verifyToken(token);

    if (!validToken) {
        res.redirect('/error/401');
        return;
    }

    const body = await getBody(req);

    if (!body.yearly || !body.saved) {
        res.status(400).send();
        return;
    }

    const income = {
        yearly: body.yearly || 0,
        saved: body.saved || 0,
    };

    writeFileSync(incomeFile, JSON.stringify(income));

    res.status(204).send();
});

app.get('/tools/finances/owed', async (req, res) => {
    const token = req.cookies.token;

    const validToken = await verifyToken(token);

    if (!validToken) {
        res.redirect('/error/401');
        return;
    }

    const owed = JSON.parse(readFileSync(owedFile).toString());

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

    const owed = JSON.parse(readFileSync(owedFile).toString());

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

    writeFileSync(owedFile, JSON.stringify(owed));

    res.status(204).send();
});

app.listen(3003, () => {
    console.log('Finances server listening on port 3003');
});
