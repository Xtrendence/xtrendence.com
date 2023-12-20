async function fetchIncome() {
    try {
        const income = await sendRequest('GET', './income');

        const parsed = JSON.parse(income);

        const yearly = parseFloat(parsed.yearly);
        const savedPercentage = parseFloat(parsed.saved);

        const monthly = yearly / 12;
        const savedAmount = monthly * (savedPercentage / 100);

        const form = document.getElementById('form-income');

        form.getElementsByTagName('input')[0].value = yearly.toFixed(0);
        form.getElementsByTagName('input')[1].value = monthly.toFixed(0);
        form.getElementsByTagName('input')[2].value = savedPercentage;
        form.getElementsByTagName('input')[3].value = savedAmount.toFixed(0);
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

        await sendRequest('POST', './income', JSON.stringify(data));

        fetchIncome();
    } catch (error) {
        console.log(error);
    }
}
