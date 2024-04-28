const compoundInterestButton = document.getElementById('compound-interest');

function calculateInvestmentGrowth(investments) {
    const result = investments.map((investment) => {
        let currentValue = investment.value;
        const monthlyInterestRate = investment.yearlyInterest / 12 / 100;
        const results = [];

        for (let year = 1; year <= 15; year++) {
            for (let month = 1; month <= 12; month++) {
                currentValue += investment.monthlyContribution;
                currentValue *= 1 + monthlyInterestRate;
            }
            results.push(parseFloat(currentValue.toFixed(2)));
        }

        return {
            label: investment.label,
            forecast: results.map((value, index) => {
                return {
                    year: index + 1,
                    value,
                };
            }),
        };
    });

    const yearlyTotal = result.reduce((acc, investment) => {
        return investment.forecast.map((year, index) => {
            return {
                year: year.year,
                value: acc[index].value + year.value,
            };
        });
    }, result[0].forecast);

    const total = [
        {
            label: 'Yearly Total',
            forecast: yearlyTotal,
        },
    ];

    return [...result, ...total];
}

function calculateCompoundInterest() {
    const compoundInterestRows = document
        .getElementById('data-compound-interest')
        .getElementsByTagName('form');

    const assetRows = document
        .getElementById('data-assets')
        .getElementsByTagName('form');

    const savingsRows = document
        .getElementById('data-savings')
        .getElementsByTagName('form');

    if (
        compoundInterestRows.length === 0 ||
        assetRows.length === 0 ||
        savingsRows.length === 0
    )
        return;

    const compoundInterests = [];

    for (const row of compoundInterestRows) {
        const label = row.getElementsByTagName('input')[0].value;
        const yearlyInterest = Number(
            row.getElementsByTagName('input')[1].value
        );
        const monthlyContribution = Number(
            row.getElementsByTagName('input')[2].value
        );

        compoundInterests.push({
            label,
            yearlyInterest,
            monthlyContribution,
        });
    }

    const assets = [];

    for (const row of assetRows) {
        const symbol = row.getElementsByTagName('input')[0].value;

        const compoundInterestAsset = compoundInterests.find(
            (row) => row.label?.toLowerCase() === symbol.toLowerCase()
        );

        if (!compoundInterestAsset) {
            continue;
        }

        const value = Number(
            row
                .getElementsByTagName('input')[2]
                .value?.split(' | ')[0]
                .replace(/,/g, '')
        );

        assets.push({
            label: symbol,
            value,
            yearlyInterest: compoundInterestAsset.yearlyInterest,
            monthlyContribution: compoundInterestAsset.monthlyContribution,
        });
    }

    const savings = [];

    for (const row of savingsRows) {
        const service = row.getElementsByTagName('input')[0].value;

        const compoundInterestService = compoundInterests.find(
            (row) => row.label?.toLowerCase() === service.toLowerCase()
        );

        if (!compoundInterestService) {
            continue;
        }

        const value = Number(row.getElementsByTagName('input')[1].value);

        console.log(value);

        savings.push({
            label: service,
            value,
            yearlyInterest: compoundInterestService.yearlyInterest,
            monthlyContribution: compoundInterestService.monthlyContribution,
        });
    }

    const result = calculateInvestmentGrowth([...assets, ...savings]);

    compoundInterestButton.setAttribute(
        'data-forecast',
        JSON.stringify(result)
    );
}

compoundInterestButton.addEventListener('click', () => {
    try {
        const result = JSON.parse(
            compoundInterestButton.getAttribute('data-forecast')
        );

        const specialYears = [1, 2, 5, 10, 15];

        const years = result
            .map((investment) => {
                return (
                    `<div class="asset"><h3>${investment.label}</h3>` +
                    investment.forecast
                        .map((year) => {
                            return `<p class="${
                                specialYears.includes(year.year)
                                    ? 'special'
                                    : ''
                            }">Year ${year.year}: £${
                                year.value.toLocaleString().split('.')[0]
                            }</p>`;
                        })
                        .join('') +
                    `</div>`
                );
            })
            .join('');

        const content = `
									<div class="compound-interest-forecast">
											<h2>Compound Interest Forecast</h2>
											<div class="years">
												${years}
											</div>
											<div>
												<button id="forecast-cancel">Cancel</button>
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
            .getElementById('forecast-cancel')
            .addEventListener('click', () => {
                notification.instance.hideNotification(notification.element);
            });
    } catch (error) {
        console.log(error);
    }
});

async function fetchCompoundInterest() {
    try {
        const response = await sendRequest('GET', './compound-interest');

        const parsed = JSON.parse(response);

        const container = document.getElementById('data-compound-interest');

        container.innerHTML = '';

        const unsorted = Object.keys(parsed).map((key) => {
            return {
                id: key,
                ...parsed[key],
            };
        });

        const sorted = unsorted.sort((a, b) => {
            return (
                Number(b.monthlyContribution) - Number(a.monthlyContribution)
            );
        });

        for (const item of sorted) {
            const id = item.id;

            container.innerHTML += `
							<form id="${id}">
								<div class="row data glass overlay compound-interest">
										<input type="text" placeholder="Asset..." value="${item.label}" />
										<input type="number" step="any" placeholder="Yearly +%..." value="${item.yearlyInterest}" />
										<input type="number" step="any" placeholder="Monthly Contribution..." value="${item.monthlyContribution}" />
								</div>
								<button type="submit" class="hidden"></button>
							</form>
						`;
        }

        const forms = container.getElementsByTagName('form');
        for (const form of forms) {
            form.addEventListener('submit', (event) => {
                event.preventDefault();
                handleFormSubmitCompoundInterest(form.getAttribute('id'));
            });
        }

        macy.recalculate(true);

        calculateCompoundInterest();
    } catch (error) {
        console.log(error);
    }
}

async function handleFormSubmitCompoundInterest(id) {
    try {
        const form = document.getElementById(id || 'form-compound-interest');

        const data = {
            id,
            label: form.getElementsByTagName('input')[0].value,
            yearlyInterest: form.getElementsByTagName('input')[1].value,
            monthlyContribution: form.getElementsByTagName('input')[2].value,
        };

        const loading = document.getElementById('loading');

        loading.classList.remove('hidden');

        await sendRequest('POST', './compound-interest', JSON.stringify(data));

        form.getElementsByTagName('input')[0].value = '';
        form.getElementsByTagName('input')[1].value = '';
        form.getElementsByTagName('input')[2].value = '';

        form.getElementsByTagName('input')[0].focus();

        loading.classList.add('hidden');

        fetchCompoundInterest();
    } catch (error) {
        document.getElementById('loading').classList.add('hidden');
        console.log(error);
    }
}

setInterval(() => {
    calculateCompoundInterest();
}, 1000);
