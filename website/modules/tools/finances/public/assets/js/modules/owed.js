async function fetchOwed() {
    try {
        const response = await sendRequest('GET', './owed');

        const parsed = JSON.parse(response);

        const container = document.getElementById('data-owed');

        container.innerHTML = '';

        const ids = Object.keys(parsed);
        for (const id of ids) {
            const item = parsed[id];

            container.innerHTML += `
						<form id="${id}">
							<div class="row data glass overlay owed">
									<input type="text" placeholder="Name..." value="${item.name}" />
									
									<input type="number" step="any" placeholder="Owes..." value="${item.owes}" />
									<input type="text" placeholder="Reason..." value="${item.reason}" />
							</div>
							<button type="submit" class="hidden"></button>
					</form>
					`;
        }

        const forms = container.getElementsByTagName('form');
        for (const form of forms) {
            form.addEventListener('submit', (event) => {
                event.preventDefault();
                handleFormSubmitOwed(form.getAttribute('id'));
            });
        }

        macy.recalculate(true);
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

        await sendRequest('POST', './owed', JSON.stringify(data));

        fetchOwed();
    } catch (error) {
        console.log(error);
    }
}
