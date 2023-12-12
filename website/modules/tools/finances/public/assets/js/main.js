fetchSavings();
fetchAssets();
fetchIncome();
fetchOwed();

const macy = Macy({
    container: '#container',
    trueOrder: false,
    waitForImages: false,
    margin: 20,
    columns: 2,
    breakAt: {
        1000: 1,
    },
});

macy.recalculate(true);

window.addEventListener('resize', () => {
    macy.recalculate(true);
});

window.document.addEventListener('click', () => {
    macy.recalculate(true);
});

async function fetchSavings() {
    try {
        const savings = await sendRequest('GET', './savings');

        const parsed = JSON.parse(savings);

        const container = document.getElementById('data-savings');

        container.innerHTML = '';

        const ids = Object.keys(parsed);
        for (const id of ids) {
            const item = parsed[id];
            const amount = parseFloat(item.amount);
            const aer = parseFloat(item.aer);
            container.innerHTML += `
						<form id="${id}">
								<div class="row data glass overlay savings">
										<input type="text" placeholder="Service..." value="${item.service}" />
										<input type="number" placeholder="Amount..." value="${item.amount}" />
										<input type="number" placeholder="AER (%)..." value="${item.aer}" />
										<input
												type="number"
												placeholder="+1Y..."
												disabled="true"
												value="${amount + amount * (aer / 100)}"
										/>
								</div>
								<button type="submit" class="hidden"></button>
						</form>
					`;
        }

        const forms = container.getElementsByTagName('form');
        for (const form of forms) {
            form.addEventListener('submit', (event) => {
                event.preventDefault();
                handleFormSubmitSavings(form.getAttribute('id'));
            });
        }

        macy.recalculate(true);
    } catch (error) {
        console.log(error);
    }
}

async function fetchAssets() {
    try {
        const assets = await sendRequest('GET', './assets');
        const prices = await sendRequest('GET', './prices');

        const parsedPrices = JSON.parse(prices);

        const usdPrice = parsedPrices['gbp=x']?.regularMarketPrice || 0;

        const parsed = JSON.parse(assets);

        const container = document.getElementById('data-assets');

        container.innerHTML = '';

        let total = 0;

        const ids = Object.keys(parsed);
        for (const id of ids) {
            if (id === 'gbp=x') continue;

            const item = parsed[id];
            const amount = parseFloat(item.amount);
            const price = parsedPrices[item.asset.toLowerCase()]
                ? parsedPrices[item.asset.toLowerCase()].regularMarketPrice
                : 0;
            const value = item.asset.toLowerCase().includes('gbp')
                ? amount * price
                : amount * price * usdPrice;

            total += value;

            container.innerHTML += `
							<form id="${id}">
									<div class="row data glass overlay assets">
											<input type="text" placeholder="Asset..." value="${item.asset}" />
											<input type="number" placeholder="Amount..." value="${amount}" />
											<input type="text" placeholder="Value..." value="${value.toLocaleString()}" disabled="true" />
									</div>
									<button type="submit" class="hidden"></button>
							</form>
						`;
        }

        const forms = container.getElementsByTagName('form');
        for (const form of forms) {
            form.addEventListener('submit', (event) => {
                event.preventDefault();
                handleFormSubmitAssets(form.getAttribute('id'));
            });
        }

        macy.recalculate(true);
    } catch (error) {
        console.log(error);
    }
}

async function fetchIncome() {}

async function fetchOwed() {}

async function handleFormSubmitSavings(id) {
    try {
        const form = document.getElementById(id || 'form-savings');

        const data = {
            id,
            service: form.getElementsByTagName('input')[0].value,
            amount: form.getElementsByTagName('input')[1].value,
            aer: form.getElementsByTagName('input')[2].value,
        };

        await sendRequest(
            'POST',
            '/tools/finances/savings',
            JSON.stringify(data)
        );

        fetchSavings();
    } catch (error) {
        console.log(error);
    }
}

async function handleFormSubmitAssets(id) {
    try {
        const form = document.getElementById(id || 'form-assets');

        const data = {
            id,
            asset: form.getElementsByTagName('input')[0].value,
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
            `/tools/finances/assets/${data.asset}`
        );

        const parsed = JSON.parse(response);

        let optionsHtml = '';
        parsed.quotes.map((quote) => {
            if (quote.symbol && quote.shortname && quote.typeDisp) {
                optionsHtml += `<div class="glass overlay option" id="${quote.symbol}">${quote.typeDisp} - ${quote.symbol} (${quote.shortname})</div>`;
            }
        });

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
        await sendRequest(
            'POST',
            '/tools/finances/assets',
            JSON.stringify(data)
        );

        fetchAssets();
    } catch (error) {
        console.log(error);
    }
}

async function handleFormSubmitIncome() {
    try {
        const form = document.getElementById('form-income');

        const data = {
            yearly: form.getElementsByTagName('input')[0].value,
            saved: form.getElementsByTagName('input')[2].value,
        };

        await sendRequest(
            'POST',
            '/tools/finances/income',
            JSON.stringify(data)
        );

        fetchIncome();
    } catch (error) {
        console.log(error);
    }
}

async function handleFormSubmitOwed(id) {
    try {
        const form = document.getElementById(id || 'form-owed');

        const data = {
            id,
            name: form.getElementsByTagName('input')[0].value,
            owes: form.getElementsByTagName('input')[1].value,
            reason: form.getElementsByTagName('input')[2].value,
        };

        await sendRequest('POST', '/tools/finances/owed', JSON.stringify(data));

        fetchOwed();
    } catch (error) {
        console.log(error);
    }
}

for (const form of document.getElementsByTagName('form')) {
    form.addEventListener('submit', (event) => {
        event.preventDefault();

        const formId = form.getAttribute('id');
        switch (formId) {
            case 'form-savings':
                handleFormSubmitSavings();
                break;
            case 'form-assets':
                handleFormSubmitAssets();
                break;
            case 'form-income':
                handleFormSubmitIncome();
                break;
            case 'form-owed':
                handleFormSubmitOwed();
                break;
        }
    });
}

function sendRequest(method, url, body) {
    const loading = document.getElementById('loading');

    loading.classList.remove('hidden');

    let xhr = new XMLHttpRequest();

    return new Promise((resolve, reject) => {
        xhr.addEventListener('readystatechange', () => {
            setTimeout(() => {
                loading.classList.add('hidden');
            }, 250);

            if (xhr.readyState !== 4) return;
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(xhr.responseText);
            } else {
                reject();
            }
        });

        xhr.open(method, url, true);
        xhr.send(body);
    });
}
