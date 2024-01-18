import axios from 'axios';

export async function money({ token }) {
    const options = {
        withCredentials: true,
        headers: {
            cookie: `token=${token}`,
        },
    };

    const [savingsResponse, assetsResponse, pricesResponse, aliasedResponse] =
        await Promise.all([
            axios.get('http://localhost:3003/savings', options),
            axios.get('http://localhost:3003/financial-assets', options),
            axios.get('http://localhost:3003/prices', options),
            axios.get('http://localhost:3003/aliased', options),
        ]);

    const savings = savingsResponse.data;
    const assets = assetsResponse.data;
    const prices = pricesResponse.data;
    const aliased = aliasedResponse.data;

    let totalSavings = 0;
    Object.keys(savings).map((key) => {
        const saving = savings[key];
        totalSavings += parseFloat(saving.amount);
    });

    const usdPrice = prices['gbp=x']?.regularMarketPrice || 0;

    let totalAssets = {
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

    const total = totalSavings + totalAssets.overall;

    return `You have £${
        totalSavings.toLocaleString().split('.')[0]
    } in savings and £${
        totalAssets.overall.toLocaleString().split('.')[0]
    } in assets, totalling £${
        total.toLocaleString().split('.')[0]
    }. Your assets are split into £${
        totalAssets.cryptocurrency.toLocaleString().split('.')[0]
    } in cryptocurrency, £${
        totalAssets.stocks.toLocaleString().split('.')[0]
    } in stocks and £${totalAssets.other.toFixed(0)} in other assets.`;
}
