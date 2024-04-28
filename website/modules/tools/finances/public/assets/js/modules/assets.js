document.getElementById('total-assets').addEventListener('click', () => {
    const totalAssets = document.getElementById('total-assets');

    const totals = {
        cryptocurrency: parseFloat(
            totalAssets.getAttribute('data-total-cryptocurrency')
        ),
        stocks: parseFloat(totalAssets.getAttribute('data-total-stocks')),
        other: parseFloat(totalAssets.getAttribute('data-total-other')),
        overall: parseFloat(totalAssets.getAttribute('data-total')),
    };

    const percentageCryptocurrency = Math.floor(
        (totals.cryptocurrency / totals.overall) * 100
    );
    const percentageStocks = Math.floor((totals.stocks / totals.overall) * 100);
    const percentageOther = 100 - percentageCryptocurrency - percentageStocks;

    const content = `
		<div class="search-result">
				<h2>Total Result</h2>
				<div class="options">
				<p>Overall: £${totals.overall.toLocaleString().split('.')[0]}</p>
				<p>Cryptocurrency (${percentageCryptocurrency.toFixed(0)}%): £${
        totals.cryptocurrency.toLocaleString().split('.')[0]
    }</p>
				<p>Stocks (${percentageStocks.toFixed(0)}%): £${
        totals.stocks.toLocaleString().split('.')[0]
    }</p>
				<p>Other (${percentageOther.toFixed(0)}%): £${
        totals.other.toLocaleString().split('.')[0]
    }</p>
				</div>
				<div>
					<button id="total-close">Close</button>
				</div>
		</div>
	`;

    const notification = Notify.info({
        content,
        duration: -1,
        width: 400,
        maxWidth: 400,
    });

    document.getElementById('total-close').addEventListener('click', () => {
        notification.instance.hideNotification(notification.element);
    });
});

async function fetchAssets() {
    try {
        const aliasedResponse = await sendRequest('GET', './aliased');
        const aliased = JSON.parse(aliasedResponse);

        const assets = await sendRequest('GET', './financial-assets');
        const prices = await sendRequest('GET', './prices');

        const goalResponse = await sendRequest('GET', './goal');

        const intervals = await sendRequest('GET', './intervals');

        const parsedPrices = JSON.parse(prices);

        const parsedGoal = JSON.parse(goalResponse);

        const parsedIntervals = JSON.parse(intervals);

        const lastPriceRefresh = new Date(parsedIntervals.lastPriceRefresh);

        const nextPriceRefresh = new Date(
            parsedIntervals.lastPriceRefresh + parsedIntervals.priceDelay
        );

        const timeUntilNextPriceRefresh =
            nextPriceRefresh.getTime() - Date.now();

        const usdPrice = parsedPrices['gbp=x']?.regularMarketPrice || 0;

        const parsed = JSON.parse(assets);

        const sortedByLastFetched = Object.values(parsedPrices)
            .sort((a, b) => {
                return a?.fetched - b?.fetched;
            })
            .map((assetPrice, index) => {
                if (
                    assetPrice?.quoteType &&
                    assetPrice.quoteType.toLowerCase() !== 'currency'
                ) {
                    const nextFetch =
                        Date.now() +
                        parsedIntervals.priceInterval * index +
                        timeUntilNextPriceRefresh;
                    return {
                        asset: assetPrice.symbol,
                        fetched: new Date(assetPrice.fetched),
                        nextFetch: new Date(nextFetch) || new Date(),
                    };
                }
            })
            .filter(Boolean);

        const container = document.getElementById('data-assets');

        container.innerHTML = '';

        let total = {
            cryptocurrency: 0,
            stocks: 0,
            other: 0,
            overall: 0,
        };

        const ids = Object.keys(parsed);

        const processed = [];

        for (const id of ids) {
            if (id === 'gbp=x') continue;

            const item = parsed[id];
            const amount = parseFloat(item.amount);
            const price = parsedPrices[item.asset.toLowerCase()]
                ? parsedPrices[item.asset.toLowerCase()].regularMarketPrice
                : 0;
            const value =
                item.asset.toLowerCase().includes('gbp') ||
                (Object.keys(aliased).includes(item.asset) &&
                    aliased[item.asset].currency === 'GBP')
                    ? amount * price
                    : amount * price * usdPrice;

            total.overall += value;

            const displayType =
                parsedPrices[
                    item.asset.toLowerCase()
                ]?.typeDisp.toLowerCase() || 'other';

            let itemType;

            switch (displayType) {
                case 'cryptocurrency':
                    total.cryptocurrency += value;
                    itemType = 'cryptocurrency';
                    break;
                case 'stock':
                    total.stocks += value;
                    itemType = 'stock';
                    break;
                case 'equity':
                    total.stocks += value;
                    itemType = 'stock';
                    break;
                case 'fund':
                    total.stocks += value;
                    itemType = 'stock';
                    break;
                case 'etf':
                    total.stocks += value;
                    itemType = 'stock';
                    break;
                default:
                    total.other += value;
                    itemType = 'other';
                    break;
            }

            processed.push({
                id,
                ...item,
                price,
                value,
                type: itemType,
            });
        }

        const totalAssets = document.getElementById('total-assets');

        const assetProgress = document.getElementById('asset-progress');
        const assetProgressSpan = document.getElementById(
            'asset-progress-span'
        );

        const goal = Number(parsedGoal.goal);

        const percentage = (total.overall * 100) / goal;

        const difference = Math.floor(goal - total.overall);

        assetProgress.setAttribute('value', percentage);
        assetProgress.setAttribute('title', `${percentage.toFixed(2)}%`);
        assetProgressSpan.textContent = `${percentage.toFixed(2)}% - ${
            difference <= 0
                ? '£0 Remaining'
                : `£${difference.toLocaleString()} Remaining`
        }`;

        totalAssets.setAttribute('data-total', total.overall);
        totalAssets.setAttribute(
            'data-total-cryptocurrency',
            total.cryptocurrency
        );
        totalAssets.setAttribute('data-total-stocks', total.stocks);
        totalAssets.setAttribute('data-total-other', total.other);
        totalAssets.innerText =
            '£' +
            total.overall
                .toLocaleString({
                    language: 'en-GB',
                })
                .split('.')[0];

        processed.sort((a, b) => {
            return b.value - a.value;
        });

        for (const item of processed) {
            const lastFetchedAsset = sortedByLastFetched.find(
                (asset) =>
                    asset.asset.toLowerCase() === item.asset.toLowerCase()
            );

            const longestTimeLeftInMinutes = Math.floor(
                (sortedByLastFetched[
                    sortedByLastFetched.length - 1
                ]?.nextFetch?.getTime() -
                    Date.now()) /
                    60000
            );

            const timeLeft = lastFetchedAsset?.nextFetch - Date.now();

            const timeLeftInMinutes = Math.floor(
                (lastFetchedAsset?.nextFetch?.getTime() - Date.now()) / 60000
            );

            const percentage =
                (timeLeftInMinutes / longestTimeLeftInMinutes) * 100;

            const color =
                percentage > 60 ? 'green' : percentage > 30 ? 'orange' : 'red';

            const currency =
                aliased[item.asset]?.currency === 'GBP' ? '£' : '$';

            const price =
                item.price < 1 ? item.price.toFixed(4) : item.price.toFixed(2);

            const hours = Math.floor(
                (timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
            );

            const minutes = Math.floor(
                (timeLeft % (1000 * 60 * 60)) / (1000 * 60)
            );

            const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

            const timeLeftString = `${hours}h ${minutes}m ${seconds}s`;

            container.innerHTML += `
						<form id="${item.id}">
								<div class="row data glass overlay assets ${item.type}">
										<input data-symbol="${item.asset}" class="input-asset" id="input-${
                item.asset
            }" type="text" placeholder="Asset..." value="${item.asset}" />
										<input type="number" class="input-amount" step="any" placeholder="Amount..." value="${
                                            item.amount
                                        }" />
										<div class="timer-wrapper">
											<div class="timer ${color}" style="height: ${percentage}%"></div>
										</div>
										<input title="Refresh: ~${timeLeftString}" data-asset="${item.asset.toLowerCase()}" type="text" class="input-value" placeholder="Value..." value="${
                item.value.toLocaleString().split('.')[0]
            } | ${currency}${price}" />
								</div>
								<button type="submit" class="hidden"></button>
						</form>
					`;
        }

        for (const inputAmount of document.getElementsByClassName(
            'input-amount'
        )) {
            inputAmount.addEventListener('blur', () => {
                inputAmount.parentElement.parentElement
                    .getElementsByTagName('button')[0]
                    .click();
            });

            inputAmount.addEventListener('keypress', (event) => {
                if (event.key === 'Enter') {
                    inputAmount.parentElement.parentElement
                        .getElementsByTagName('button')[0]
                        .click();
                }
            });
        }

        for (const inputValue of document.getElementsByClassName(
            'input-value'
        )) {
            inputValue.addEventListener('focus', () => {
                inputValue.blur();
            });

            inputValue.addEventListener('keypress', () => {
                inputValue.blur();
            });

            inputValue.addEventListener('click', async () => {
                inputValue.blur();
                const asset = inputValue.getAttribute('data-asset');

                document.getElementById('loading').classList.remove('hidden');

                try {
                    await sendRequest('DELETE', `./prices/${asset}`);

                    setTimeout(() => {
                        location.reload();
                    }, 2500);
                } catch (error) {
                    document.getElementById('loading').classList.add('hidden');
                    console.log(error);
                }
            });
        }

        for (const inputAsset of document.getElementsByClassName(
            'input-asset'
        )) {
            const asset = inputAsset.getAttribute('data-symbol');

            if (
                !Object.keys(aliased).includes(asset) &&
                !asset.includes('-USD')
            )
                continue;

            inputAsset.value = Object.keys(aliased).includes(asset)
                ? aliased[asset].symbol
                : asset.replace('-USD', '');

            inputAsset.addEventListener('focus', () => {
                inputAsset.value = asset;
            });

            inputAsset.addEventListener('blur', () => {
                inputAsset.value = Object.keys(aliased).includes(asset)
                    ? aliased[asset].symbol
                    : asset.replace('-USD', '');
            });
        }

        const forms = container.getElementsByTagName('form');
        for (const form of forms) {
            form.addEventListener('submit', (event) => {
                event.preventDefault();
                handleFormSubmitAssets(form.getAttribute('id'));
            });
        }

        setTotals();
        fetchCompoundInterest();

        macy.recalculate(true);
    } catch (error) {
        console.log(error);
    }
}

async function handleFormSubmitAssets(id) {
    try {
        const form = document.getElementById(id || 'form-assets');

        const inputAsset = form.getElementsByTagName('input')[0];

        const data = {
            id,
            asset:
                inputAsset.value.charAt(0) === '-'
                    ? inputAsset.value
                    : inputAsset.hasAttribute('data-symbol')
                    ? inputAsset.getAttribute('data-symbol')
                    : inputAsset.value,
            amount: form.getElementsByTagName('input')[1].value,
        };

        const prices = await sendRequest('GET', './prices');
        const parsedPrices = JSON.parse(prices);

        if (
            data.asset.charAt(0) === '-' ||
            parsedPrices[data.asset.toLowerCase()]
        ) {
            submitAsset(data);
            return;
        }

        const response = await sendRequest(
            'GET',
            `./financial-assets/${data.asset}`
        );

        const parsed = JSON.parse(response);

        let optionsHtml = '';
        parsed.quotes.map((quote) => {
            if (quote.symbol && quote.shortname && quote.typeDisp) {
                optionsHtml += `<div class="glass overlay option" id="${quote.symbol}">${quote.typeDisp} - ${quote.symbol} (${quote.shortname})</div>`;
            }
        });

        if (!optionsHtml || parsed?.quotes?.length === 0) {
            return;
        }

        const content = `
				<div class="search-result">
						<h2>Search Result</h2>
						<p>Please choose an asset from the list below.</p>
						<div class="options">
							${optionsHtml}
						</div>
						<div>
							<button id="search-cancel">Cancel</button>
						</div>
				</div>
			`;

        const notification = Notify.info({
            content,
            duration: -1,
            width: 400,
            maxWidth: 400,
        });

        document
            .getElementById('search-cancel')
            .addEventListener('click', () => {
                notification.instance.hideNotification(notification.element);
            });

        const options = notification.element.getElementsByClassName('option');
        for (const option of options) {
            option.addEventListener('click', () => {
                data.asset = option.getAttribute('id');
                notification.instance.hideNotification(notification.element);
                submitAsset(data);
            });
        }
    } catch (error) {
        console.log(error);
    }
}

async function submitAsset(data) {
    try {
        const loading = document.getElementById('loading');

        loading.classList.remove('hidden');

        await sendRequest('POST', './financial-assets', JSON.stringify(data));

        loading.classList.add('hidden');

        const form = document.getElementById('form-assets');
        for (const input of form.getElementsByTagName('input')) {
            input.value = '';
            form.getElementsByTagName('input')[0].focus();
        }

        fetchAssets();
        fetchCompoundInterest();
    } catch (error) {
        console.log(error);
    }
}
