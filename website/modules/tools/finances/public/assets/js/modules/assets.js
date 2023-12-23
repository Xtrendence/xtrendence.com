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

    const content = `
		<div class="search-result">
				<h2>Total Result</h2>
				<div class="options">
				<p>Overall: £${totals.overall.toLocaleString().split('.')[0]}</p>
				<p>Cryptocurrency: £${totals.cryptocurrency.toLocaleString().split('.')[0]}</p>
				<p>Stocks: £${totals.stocks.toLocaleString().split('.')[0]}</p>
				<p>Other: £${totals.other.toLocaleString().split('.')[0]}</p>
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

        const parsedPrices = JSON.parse(prices);

        const usdPrice = parsedPrices['gbp=x']?.regularMarketPrice || 0;

        const parsed = JSON.parse(assets);

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

            switch (displayType) {
                case 'cryptocurrency':
                    total.cryptocurrency += value;
                    break;
                case 'stock':
                    total.stocks += value;
                    break;
                case 'equity':
                    total.stocks += value;
                    break;
                case 'fund':
                    total.stocks += value;
                    break;
                default:
                    total.other += value;
                    break;
            }

            processed.push({
                id,
                ...item,
                price,
                value,
            });
        }

        const totalAssets = document.getElementById('total-assets');

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
            container.innerHTML += `
						<form id="${item.id}">
								<div class="row data glass overlay assets">
										<input data-symbol="${item.asset}" class="input-asset" id="input-${
                item.asset
            }" type="text" placeholder="Asset..." value="${item.asset}" />
										<input type="number" step="any" placeholder="Amount..." value="${
                                            item.amount
                                        }" />
										<input type="text" placeholder="Value..." value="${
                                            item.value
                                                .toLocaleString()
                                                .split('.')[0]
                                        }" disabled="true" />
								</div>
								<button type="submit" class="hidden"></button>
						</form>
					`;
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
    } catch (error) {
        console.log(error);
    }
}
