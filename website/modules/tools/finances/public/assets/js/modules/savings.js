async function fetchSavings() {
    try {
        const savings = await sendRequest('GET', './savings');

        const parsed = JSON.parse(savings);

        const container = document.getElementById('data-savings');

        container.innerHTML = '';

        let total = 0;
        let totalWithInterest = 0;

        const ids = Object.keys(parsed);

        const sorted = ids.sort((a, b) => {
            return parseFloat(parsed[b].amount) - parseFloat(parsed[a].amount);
        });

        for (const id of sorted) {
            const item = parsed[id];
            const amount = parseFloat(item.amount);
            const aer = parseFloat(item.aer);
            total += amount;
            totalWithInterest += amount + amount * (aer / 100);
            container.innerHTML += `
					<form id="${id}">
							<div class="row data glass overlay savings">
									<input type="text" placeholder="Service..." value="${item.service}" />
									<input type="number" step="any" placeholder="Amount..." value="${
                                        item.amount
                                    }" />
									<input type="number" step="any" placeholder="AER (%)..." value="${item.aer}" />
									<input
											type="number"
											step="any"
											placeholder="+1Y..."
											disabled="true"
											value="${(amount + amount * (aer / 100)).toFixed(0)}"
									/>
							</div>
							<button type="submit" class="hidden"></button>
					</form>
				`;
        }

        const totalSavings = document.getElementById('total-savings');

        totalSavings.setAttribute('data-total', total);
        totalSavings.setAttribute(
            'data-total-with-interest',
            totalWithInterest
        );
        totalSavings.innerText = '£' + total.toLocaleString();

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

async function handleFormSubmitSavings(id) {
    try {
        const form = document.getElementById(id || 'form-savings');

        const data = {
            id,
            service: form.getElementsByTagName('input')[0].value,
            amount: form.getElementsByTagName('input')[1].value,
            aer: form.getElementsByTagName('input')[2].value,
        };

        await sendRequest('POST', './savings', JSON.stringify(data));

        for (const input of form.getElementsByTagName('input')) {
            input.value = '';
            form.getElementsByTagName('input')[0].focus();
        }

        fetchSavings();
    } catch (error) {
        console.log(error);
    }
}
