const dataTotal = document.getElementById('data-total');
const overall = dataTotal.getElementsByTagName('input')[0];
const oneYearWithInterest = dataTotal.getElementsByTagName('input')[1];
const oneYearWithSalary = dataTotal.getElementsByTagName('input')[2];
const sixMonthsWithSalary = dataTotal.getElementsByTagName('input')[3];

function setTotals() {
    const unpaidIncome = document.getElementById('unpaid-income');

    const totalCurrentIncome =
        unpaidIncome.hasAttribute('data-current') &&
        unpaidIncome.getAttribute('data-current') !== null &&
        unpaidIncome.getAttribute('data-current') !== 'NaN'
            ? parseFloat(unpaidIncome.getAttribute('data-current'))
            : 0;
    const totalSavings = parseFloat(
        document.getElementById('total-savings').getAttribute('data-total')
    );
    const totalAssets = parseFloat(
        document.getElementById('total-assets').getAttribute('data-total')
    );

    const total = totalSavings + totalAssets + totalCurrentIncome;
    overall.value = '£' + total.toLocaleString().split('.')[0];

    const totalSavingsWithInterest = parseFloat(
        document
            .getElementById('total-savings')
            .getAttribute('data-total-with-interest')
    );

    const interest = totalSavingsWithInterest - totalSavings;

    const oneYearWithInterestValue =
        totalAssets + totalSavingsWithInterest + totalCurrentIncome;

    oneYearWithInterest.value =
        '£' + oneYearWithInterestValue.toLocaleString().split('.')[0];

    const savedAmount = parseFloat(
        document.getElementById('form-income').getElementsByTagName('input')[3]
            .value
    );

    const oneYearWithSalaryValue =
        oneYearWithInterestValue + totalCurrentIncome + savedAmount * 12;

    oneYearWithSalary.value =
        '£' + oneYearWithSalaryValue.toLocaleString().split('.')[0];

    sixMonthsWithSalary.value =
        '£' +
        (total + savedAmount * 6 + interest / 2).toLocaleString().split('.')[0];
}

(async () => {
    const date = new Date();
    const startDate = new Date(date.setMonth(date.getMonth() - 3));

    await fetchHistory(
        startDate.toISOString().split('T')[0],
        new Date().toISOString().split('T')[0]
    );

    await fetchSavings();
    await fetchAssets();
    await fetchIncome();
    await fetchOwed();
    setTotals();
})();

// Fetch data every 20 minutes.
setInterval(async () => {
    const date = new Date();
    const startDate = new Date(date.setMonth(date.getMonth() - 3));

    await fetchHistory(
        startDate.toISOString().split('T')[0],
        new Date().toISOString().split('T')[0]
    );

    await fetchSavings();
    await fetchAssets();
    await fetchIncome();
    await fetchOwed();
    setTotals();
}, 1000 * 60 * 20);

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
