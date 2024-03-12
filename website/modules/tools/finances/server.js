import express from 'express';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dateTime, validJSON, verifyToken, saveTotal } from './utils/utils.js';
import cookieParser from 'cookie-parser';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import yahooFinance from 'yahoo-finance2';
import cors from 'cors';
import { addSavingsRoutes } from './utils/addSavingsRoutes.js';
import { addAssetsRoutes } from './utils/addAssetsRoutes.js';
import { addIncomeRoutes } from './utils/addIncomeRoutes.js';
import { addOwedRoutes } from './utils/addOwedRoutes.js';
import gradient from 'gradient-string';
import { addHistoryRoutes } from './utils/addHistoryRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const searchInterval = 86400000; // 1 day
const historyInterval = 14400000; // 4 hours
const priceInterval = 1800000; // 30 minutes
const priceDelay = 600000; // 10 minutes

const dataDirectory = path.join(__dirname, 'data');

const aliasedFile = path.join(__dirname, 'data/aliased.db');
const searchesFile = path.join(__dirname, 'data/searches.db');
const pricesFile = path.join(__dirname, 'data/prices.db');

const historyFolder = path.join(__dirname, 'data/history');
const savingsFile = path.join(__dirname, 'data/savings.db');
const assetsFile = path.join(__dirname, 'data/assets.db');
const incomeFile = path.join(__dirname, 'data/income.db');
const owedFile = path.join(__dirname, 'data/owed.db');

if (!existsSync(dataDirectory)) {
  mkdirSync(dataDirectory);
}

if (!existsSync(historyFolder)) {
  mkdirSync(historyFolder);
}

const files = {
  aliasedFile: {
    file: aliasedFile,
    type: 'object',
  },
  searchesFile: {
    file: searchesFile,
    type: 'object',
  },
  pricesFile: {
    file: pricesFile,
    type: 'object',
  },
  savingsFile: {
    file: savingsFile,
    type: 'object',
  },
  assetsFile: {
    file: assetsFile,
    type: 'object',
  },
  incomeFile: {
    file: incomeFile,
    type: 'object',
  },
  owedFile: {
    file: owedFile,
    type: 'object',
  },
};

for (const file of Object.values(files)) {
  if (
    !existsSync(file.file) ||
    !validJSON(readFileSync(file.file).toString())
  ) {
    writeFileSync(file.file, JSON.stringify(file.type === 'object' ? {} : []));
  }
}

refreshPrices();

const app = express();

app.use(cors({ origin: '*' }));

app.use(cookieParser());

app.use('/assets', express.static('public/assets'));

app.get('/', async (req, res) => {
  const token = req.cookies.token;

  const validToken = await verifyToken(token);

  if (!validToken) {
    res.redirect('/error/401');
    return;
  }

  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.get('/snapshot', async (req, res) => {
  try {
    const token = req.cookies.token;

    const validToken = await verifyToken(token);

    if (!validToken) {
      res.redirect('/error/401');
      return;
    }

    const filename = `${new Date().toISOString().split('T')[0]}.db`;
    const historyFile = `${historyFolder}/${filename}`;

    const historyData = JSON.parse(readFileSync(historyFile).toString()) || [];

    const history = historyData.sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );

    if (history.length === 0) {
      res.status(200).send({ nextSnapshot: new Date() });
      return;
    }

    const previousSnapshot = new Date(
      history[history.length - 1].date
    ).getTime();

    const timeSinceLastSnapshot = Date.now() - previousSnapshot;

    const timeLeft = historyInterval - timeSinceLastSnapshot;

    res.status(200).send({ nextSnapshot: new Date(Date.now() + timeLeft) });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

addHistoryRoutes(app, historyFolder);

addSavingsRoutes(app, { savingsFile });

addAssetsRoutes(
  app,
  { aliasedFile, assetsFile, searchesFile, pricesFile },
  { searchInterval, priceInterval, priceDelay }
);

addIncomeRoutes(app, { incomeFile });

addOwedRoutes(app, { owedFile });

async function refreshPrices() {
  try {
    console.log(gradient.cristal(`Refreshing prices... [${dateTime()}]`));

    const assets = JSON.parse(readFileSync(assetsFile).toString());
    const prices = JSON.parse(readFileSync(pricesFile).toString());

    if (!prices['lastFetched']) {
      prices['lastFetched'] = 0;
    }

    const symbols = [];

    for (const id of Object.keys(assets)) {
      const asset = assets[id].asset;
      symbols.push(asset.toLowerCase());
    }

    const priceSymbols = Object.keys(prices);
    for (let i = 0; i < priceSymbols.length; i++) {
      if (
        !symbols.includes(priceSymbols[i]) &&
        priceSymbols[i] !== 'lastFetched'
      ) {
        delete prices[priceSymbols[i]];
      }

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

    sortedPrices.splice(sortedPrices.indexOf('lastFetched'), 1);

    for (let i = 0; i < sortedPrices.length; i++) {
      if (
        prices[sortedPrices[i]].fetched + priceInterval < Date.now() &&
        prices['lastFetched'] + priceDelay < Date.now()
      ) {
        console.log(
          gradient('pink', 'lightPink'),
          `Fetching ${
            sortedPrices[i]
          } price from Yahoo Finance... [${dateTime()}]`
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

// Check if history needs to be saved every 20 minutes. Actual saving is based on the historyInterval.
setInterval(() => {
  saveTotal(files, historyFolder, historyInterval);
}, 1200000);

saveTotal(files, historyFolder, historyInterval);

app.listen(3003, () => {
  console.log(
    gradient('lightPink', 'lightBlue')('Finances server listening on port 3003')
  );
});
