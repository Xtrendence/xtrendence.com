import { verifyToken, getBody, generateId } from './utils.js';
import { readFileSync, writeFileSync } from 'fs';
import yahooFinance from 'yahoo-finance2';

export function addAssetsRoutes(app, files, intervals) {
    console.log('Intervals: ', intervals);

    app.get('/aliased', async (req, res) => {
        const token = req.cookies.token;

        const validToken = await verifyToken(token);

        if (!validToken) {
            res.redirect('/error/401');
            return;
        }

        const aliased = JSON.parse(readFileSync(files.aliasedFile).toString());

        res.status(200).send(aliased);
    });

    app.get('/prices', async (req, res) => {
        const token = req.cookies.token;

        const validToken = await verifyToken(token);

        if (!validToken) {
            res.redirect('/error/401');
            return;
        }

        const prices = JSON.parse(readFileSync(files.pricesFile).toString());

        res.status(200).send(prices);
    });

    app.get('/financial-assets/:asset', async (req, res) => {
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

            const searches = JSON.parse(
                readFileSync(files.searchesFile).toString()
            );

            // Limit to 1 search per day for each asset. New crypto and stocks are unlikely to be added or removed that often.
            if (
                searches[asset.toLocaleLowerCase()] &&
                searches[asset.toLowerCase()].fetched +
                    intervals.searchInterval >
                    Date.now()
            ) {
                res.status(200).send(searches[asset.toLowerCase()]);
                return;
            }

            console.log(`Fetching ${asset} info from Yahoo Finance...`);

            const response = await yahooFinance.search(asset);

            if (response) {
                searches[asset.toLowerCase()] = {
                    ...response,
                    fetched: Date.now(),
                    fetchedTime: new Date().toLocaleString(),
                };

                writeFileSync(
                    files.searchesFile,
                    JSON.stringify(searches, null, 4)
                );

                res.status(200).send(response);
            }
        } catch (error) {
            console.log(error);
        }
    });

    app.get('/financial-assets', async (req, res) => {
        console.log(req.cookies.token);
        const token = req.cookies.token;

        const validToken = await verifyToken(token);

        if (!validToken) {
            res.redirect('/error/401');
            return;
        }

        const assets = JSON.parse(readFileSync(files.assetsFile).toString());

        res.status(200).send(assets);
    });

    app.post('/financial-assets', async (req, res) => {
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

        const asset =
            bodyAsset.charAt(0) === '-' ? bodyAsset.slice(1) : bodyAsset;

        const assets = JSON.parse(readFileSync(files.assetsFile).toString());

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
                    const prices = JSON.parse(
                        readFileSync(files.pricesFile).toString()
                    );

                    if (!prices['lastFetched']) {
                        prices['lastFetched'] = 0;
                    }

                    // Limit to 1 price fetch per hour for each asset, with a 20 minute delay between each asset.
                    if (
                        !prices[asset.toLowerCase()] ||
                        (prices[asset.toLowerCase()].fetched +
                            intervals.priceInterval <
                            Date.now() &&
                            prices['lastFetched'] + intervals.priceDelay <
                                Date.now())
                    ) {
                        console.log(
                            `Fetching ${asset} price from Yahoo Finance...`
                        );

                        prices['lastFetched'] = Date.now();
                        const response = await yahooFinance.quote(asset);

                        if (response) {
                            prices[asset.toLowerCase()] = {
                                ...response,
                                fetched: Date.now(),
                                fetchedTime: new Date().toLocaleString(),
                            };

                            writeFileSync(
                                files.pricesFile,
                                JSON.stringify(prices, null, 4)
                            );
                        }
                    }
                } catch (error) {
                    console.log(error);
                }
            }
        }

        writeFileSync(files.assetsFile, JSON.stringify(assets));

        res.status(204).send();
    });
}
