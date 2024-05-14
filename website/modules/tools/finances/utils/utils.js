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
            ? prices[item.asset.toLowerCase()]?.preMarketPrice ||
              prices[item.asset.toLowerCase()]?.postMarketPrice ||
              prices[item.asset.toLowerCase()].regularMarketPrice
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
            case 'etf':
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

    const excludeUnpaidIncome = Object.values(savings)?.find(
        (item) => item?.service?.toLowerCase() === 'eui'
    );

    const limited = excludeUnpaidIncome
        ? 0
        : currentTotal > max
        ? max
        : currentTotal;

    history.push({
        day: new Date().toISOString().split('T')[0],
        date: new Date().toISOString(),
        totalSavings,
        totalAssets,
        totalUnpaidIncome: limited.toFixed(3),
        notes: excludeUnpaidIncome
            ? 'Excluded Unpaid Income'
            : 'Included Unpaid Income',
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

export function sendReport(historyFolder, reportHours) {
    try {
        const now = new Date();
        const hours = now.getHours();

        const time = now.getTime();
        const yesterday = new Date(time - 86400000).toISOString().split('T')[0];
        const today = now.toISOString().split('T')[0];

        const filenameYesterday = `${yesterday}.db`;
        const filenameToday = `${today}.db`;

        const contentYesterday = readFileSync(
            `${historyFolder}/${filenameYesterday}`
        );
        const contentToday = readFileSync(`${historyFolder}/${filenameToday}`);

        const historyYesterday = JSON.parse(contentYesterday);
        const historyToday = JSON.parse(contentToday);

        const dataYesterday = historyYesterday[0];
        const dataToday = historyToday[historyToday.length - 1];

        console.log('Data Yesterday:', dataYesterday);
        console.log('Data Today:', dataToday);

        const totalSavingsYesterday = Number(dataYesterday.totalSavings);
        const totalSavingsToday = Number(dataToday.totalSavings);
        const totalSavingsDifference =
            totalSavingsToday - totalSavingsYesterday;
        const totalSavingsDifferencePercentage =
            (totalSavingsDifference / totalSavingsYesterday) * 100;

        const totalCryptoYesterday = Number(
            dataYesterday.totalAssets.cryptocurrency
        );
        const totalCryptoToday = Number(dataToday.totalAssets.cryptocurrency);
        const totalCryptoDifference = totalCryptoToday - totalCryptoYesterday;
        const totalCryptoDifferencePercentage =
            (totalCryptoDifference / totalCryptoYesterday) * 100;

        const totalStocksYesterday = Number(dataYesterday.totalAssets.stocks);
        const totalStocksToday = Number(dataToday.totalAssets.stocks);
        const totalStocksDifference = totalStocksToday - totalStocksYesterday;
        const totalStocksDifferencePercentage =
            (totalStocksDifference / totalStocksYesterday) * 100;

        const totalOtherYesterday = Number(dataYesterday.totalAssets.other);
        const totalOtherToday = Number(dataToday.totalAssets.other);
        const totalOtherDifference = totalOtherToday - totalOtherYesterday;
        const totalOtherDifferencePercentage =
            (totalOtherDifference / totalOtherYesterday) * 100;

        const totalOverallYesterday = Number(dataYesterday.totalAssets.overall);
        const totalOverallToday = Number(dataToday.totalAssets.overall);
        const totalOverallDifference =
            totalOverallToday - totalOverallYesterday;
        const totalOverallDifferencePercentage =
            (totalOverallDifference / totalOverallYesterday) * 100;

        const totalYesterday = Number(dataYesterday.total);
        const totalToday = Number(dataToday.total);
        const totalDifference = totalToday - totalYesterday;
        const totalDifferencePercentage =
            (totalDifference / totalYesterday) * 100;

        const totalSavingsSymbol = {
            emoji:
                totalSavingsDifference > 0
                    ? '📈'
                    : totalSavingsDifference < 0
                    ? '📉'
                    : '🟰',
            operator:
                totalSavingsDifference > 0
                    ? '+'
                    : totalSavingsDifference < 0
                    ? '-'
                    : '',
        };

        const totalCryptoSymbol = {
            emoji:
                totalCryptoDifference > 0
                    ? '📈'
                    : totalCryptoDifference < 0
                    ? '📉'
                    : '🟰',
            operator:
                totalCryptoDifference > 0
                    ? '+'
                    : totalCryptoDifference < 0
                    ? '-'
                    : '',
        };

        const totalStocksSymbol = {
            emoji:
                totalStocksDifference > 0
                    ? '📈'
                    : totalStocksDifference < 0
                    ? '📉'
                    : '🟰',
            operator:
                totalStocksDifference > 0
                    ? '+'
                    : totalStocksDifference < 0
                    ? '-'
                    : '',
        };

        const totalOtherSymbol = {
            emoji:
                totalOtherDifference > 0
                    ? '📈'
                    : totalOtherDifference < 0
                    ? '📉'
                    : '🟰',
            operator:
                totalOtherDifference > 0
                    ? '+'
                    : totalOtherDifference < 0
                    ? '-'
                    : '',
        };

        const totalOverallSymbol = {
            emoji:
                totalOverallDifference > 0
                    ? '📈'
                    : totalOverallDifference < 0
                    ? '📉'
                    : '🟰',
            operator:
                totalOverallDifference > 0
                    ? '+'
                    : totalOverallDifference < 0
                    ? '-'
                    : '',
        };

        const totalDifferenceSymbol = {
            emoji:
                totalDifference > 0 ? '📈' : totalDifference < 0 ? '📉' : '🟰',
            operator:
                totalDifference > 0 ? '+' : totalDifference < 0 ? '-' : '',
        };

        const bodyLines = [
            `📅 ${today}`,
            `\n`,
            `⌛ ${
                hours === reportHours[0]
                    ? 'Since Yesterday'
                    : 'Since This Morning'
            }`,
            `\n`,
            `🪙 Total Savings: £${Math.floor(
                totalSavingsToday
            ).toLocaleString()}`,
            `(${totalSavingsSymbol.emoji} ${
                totalSavingsSymbol.operator
            }£${totalSavingsDifference.toFixed(
                2
            )} | ${totalSavingsDifferencePercentage.toFixed(2)}%)`,
            `\n`,
            `💰 Cryptocurrency: £${Math.floor(
                totalCryptoToday
            ).toLocaleString()}`,
            `(${totalCryptoSymbol.emoji} ${
                totalCryptoSymbol.operator
            }£${totalCryptoDifference.toFixed(
                2
            )} | ${totalCryptoDifferencePercentage.toFixed(2)}%)`,
            `\n`,
            `💼 Stocks: £${Math.floor(totalStocksToday).toLocaleString()}`,
            `(${totalStocksSymbol.emoji} ${
                totalStocksSymbol.operator
            }£${totalStocksDifference.toFixed(
                2
            )} | ${totalStocksDifferencePercentage.toFixed(2)}%)`,
            `\n`,
            `🏦 Other: £${Math.floor(totalOtherToday).toLocaleString()}`,
            `(${totalOtherSymbol.emoji} ${
                totalOtherSymbol.operator
            }£${totalOtherDifference.toFixed(
                2
            )} | ${totalOtherDifferencePercentage.toFixed(2)}%)`,
            `\n`,
            `💵 Overall: £${Math.floor(totalOverallToday).toLocaleString()}`,
            `(${totalOverallSymbol.emoji} ${
                totalOverallSymbol.operator
            }£${totalOverallDifference.toFixed(
                2
            )} | ${totalOverallDifferencePercentage.toFixed(2)}%)`,
            `\n`,
            `📊 Total: £${Math.floor(totalToday).toLocaleString()}`,
            `(${totalDifferenceSymbol.emoji} ${
                totalDifferenceSymbol.operator
            }£${totalDifference.toFixed(
                2
            )} | ${totalDifferencePercentage.toFixed(2)}%)`,
        ];

        const body = bodyLines.join('\n');

        const token = process.env.BOT_KEY;

        const notification = {
            title: Buffer.from(
                encodeURIComponent(`💵 Financial Report 💵`)
            ).toString('base64'),
            body: Buffer.from(encodeURIComponent(body)).toString('base64'),
        };

        const url = `https://xtrendence.com/bot/fcm/${token}?title=${notification.title}&body=${notification.body}`;

        fetch(url, {
            method: 'GET',
        })
            .then((text) => {
                return text.text();
            })
            .then((response) => {
                console.log(response);
            })
            .catch((error) => {
                console.log(error);
            });
    } catch (error) {
        console.log(error);
    }
}
