import axios from 'axios';
import crypto from 'crypto';
import { existsSync, readFileSync, writeFileSync } from 'fs';

export function generateId() {
    return Date.now() + '-' + crypto.randomBytes(16).toString('hex');
}

export function dateTime() {
    const date = new Date();
    return `${date.toISOString().split('T')[0]} at ${
        date.toTimeString().split(' ')[0]
    }`;
}

export function verifyToken(token) {
    return new Promise((resolve, _) => {
        if (!token) {
            resolve(false);
            return;
        }

        axios
            .post('http://localhost:3002/verify', {
                token,
            })
            .then((response) => {
                if (response?.data?.valid === true) {
                    resolve(true);
                    return;
                }

                resolve(false);
                return;
            })
            .catch((error) => {
                console.log(error);
                resolve(false);
                return;
            });
    });
}

export function validJSON(string) {
    try {
        JSON.parse(string);
    } catch (e) {
        return false;
    }
    return true;
}

export function getBody(req) {
    return new Promise((resolve, reject) => {
        if (req.body && Object.keys(req.body).length > 0) {
            resolve(req.body);
            return;
        }

        req.on('data', (data) => {
            const body = data.toString();
            if (validJSON(body)) {
                const parsed = JSON.parse(body);
                resolve(parsed);
                return;
            }

            reject({
                error: 'Invalid JSON.',
                body,
            });
        });

        req.on('error', (error) => {
            reject(error);
            return;
        });

        setTimeout(() => {
            reject({
                error: 'Request timed out.',
            });
            return;
        }, 5000);
    });
}

export function daysInThisMonth() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

export function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

export function saveTotal(files, historyFolder, interval) {
    const filename = `${new Date().toISOString().split('T')[0]}.db`;
    const historyFile = `${historyFolder}/${filename}`;

    if (!existsSync(historyFile)) {
        writeFileSync(historyFile, JSON.stringify([]));
    }

    console.log('History File:', historyFile);

    const timesPerDay = 86400000 / interval;

    console.log('Times Per Day:', timesPerDay);

    const historyData = JSON.parse(readFileSync(historyFile).toString()) || [];

    const history = historyData.sort(
        (a, b) => new Date(a.date) - new Date(b.date)
    );

    const saveRequired =
        history.length === 0 ||
        new Date(history[history.length - 1].date).getTime() + interval <
            Date.now();

    console.log('Save Required:', saveRequired);

    if (!saveRequired) return;

    const aliased =
        JSON.parse(readFileSync(files.aliasedFile.file).toString()) || {};
    const prices =
        JSON.parse(readFileSync(files.pricesFile.file).toString()) || {};
    const assets =
        JSON.parse(readFileSync(files.assetsFile.file).toString()) || {};
    const savings =
        JSON.parse(readFileSync(files.savingsFile.file).toString()) || {};
    const income =
        JSON.parse(readFileSync(files.incomeFile.file).toString()) || {};

    const totalSavings = Object.values(savings).reduce((acc, current) => {
        try {
            const amount = Number(current.amount);
            return acc + amount;
        } catch (error) {
            return acc;
        }
    }, 0);

    console.log(`Total Savings: ${totalSavings}`);

    const usdPrice = prices['gbp=x']?.regularMarketPrice || 0;

    const totalAssets = {
        cryptocurrency: 0,
        stocks: 0,
        other: 0,
        overall: 0,
    };

    const ids = Object.keys(assets);

    for (const id of ids) {
        if (id === 'gbp=x') continue;

        const item = assets[id];
        const amount = parseFloat(item.amount);
        const price = prices[item.asset.toLowerCase()]
            ? prices[item.asset.toLowerCase()].regularMarketPrice
            : 0;
        const value =
            item.asset.toLowerCase().includes('gbp') ||
            (Object.keys(aliased).includes(item.asset) &&
                aliased[item.asset].currency === 'GBP')
                ? amount * price
                : amount * price * usdPrice;

        totalAssets.overall += value;

        const displayType =
            prices[item.asset.toLowerCase()]?.typeDisp.toLowerCase() || 'other';

        switch (displayType) {
            case 'cryptocurrency':
                totalAssets.cryptocurrency += value;
                break;
            case 'stock':
                totalAssets.stocks += value;
                break;
            case 'equity':
                totalAssets.stocks += value;
                break;
            case 'fund':
                totalAssets.stocks += value;
                break;
            default:
                totalAssets.other += value;
                break;
        }
    }

    console.log(`Total Assets: ${totalAssets.overall}`);

    const yearly = parseFloat(income.yearly);

    const daily = yearly / 365;
    const hourly = daily / 24;
    const minute = hourly / 60;
    const second = minute / 60;

    const secondsInADay = 86400;
    const secondsInThisMonth = secondsInADay * daysInThisMonth();

    const max = secondsInThisMonth * second;

    const now = new Date();
    const dayOne = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const distance = now - dayOne;
    const totalSeconds = Math.floor(distance / 1000);

    const currentTotal = second * totalSeconds;

    const limited = currentTotal > max ? max : currentTotal;

    history.push({
        day: new Date().toISOString().split('T')[0],
        date: new Date().toISOString(),
        totalSavings,
        totalAssets,
        totalUnpaidIncome: limited.toFixed(3),
        total: totalSavings + totalAssets.overall + limited,
    });

    writeFileSync(historyFile, JSON.stringify(history, null, 4));
}

export function generateMockData(historyFolder) {
    let from = new Date(2023, 10, 17);
    let to = new Date(2024, 1, 17);

    for (let day = from; day <= to; day.setDate(day.getDate() + 1)) {
        const file = `${historyFolder}/${day.toISOString().split('T')[0]}.db`;

        const history = [];

        for (let i = 0; i < 6; i++) {
            const totalSavings = Math.floor(Math.random() * 30000) + 20000;
            const totalCrpytocurrency = randomBetween(2000, 5000);
            const totalStocks = randomBetween(500, 2000);
            const totalAssets = {
                cryptocurrency: totalCrpytocurrency,
                stocks: totalStocks,
                other: 0,
                overall: totalCrpytocurrency + totalStocks,
            };
            const totalUnpaidIncome = Math.floor(Math.random() * 1000) + 1000;

            const date = new Date(day.setHours(i * 4));

            console.log('Date:', date);

            if (
                date.toISOString().split('T')[0] ===
                day.toISOString().split('T')[0]
            ) {
                history.push({
                    day: date.toISOString().split('T')[0],
                    date: date.toISOString(),
                    totalSavings,
                    totalAssets,
                    totalUnpaidIncome,
                    total:
                        totalSavings + totalAssets.overall + totalUnpaidIncome,
                });
            }
        }

        writeFileSync(
            file,
            JSON.stringify(
                history.filter(
                    (item) => item.day === day.toISOString().split('T')[0]
                ),
                null,
                4
            )
        );
    }
}
