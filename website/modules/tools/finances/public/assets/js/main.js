const historyMonths = 48;

const dataTotal = document.getElementById('data-total');
const overall = dataTotal.getElementsByTagName('input')[0];
const oneYearWithInterest = dataTotal.getElementsByTagName('input')[1];
const oneYearWithSalary = dataTotal.getElementsByTagName('input')[2];
const sixMonthsWithSalary = dataTotal.getElementsByTagName('input')[3];

const lastRefresh = new Date();
let nextSnapshot;

function setTotals() {
    const unpaidIncome = document.getElementById('unpaid-income');

    const includeUnpaidIncome =
        localStorage.getItem('includeUnpaidIncome') === 'true';

    const totalCurrentIncome = includeUnpaidIncome
        ? unpaidIncome.hasAttribute('data-current') &&
          unpaidIncome.getAttribute('data-current') !== null &&
          unpaidIncome.getAttribute('data-current') !== 'NaN'
            ? parseFloat(unpaidIncome.getAttribute('data-current'))
            : 0
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

    oneYearWithSalary.value = isNaN(oneYearWithSalaryValue)
        ? '-'
        : '£' + oneYearWithSalaryValue.toLocaleString().split('.')[0];

    sixMonthsWithSalary.value = isNaN(oneYearWithSalaryValue)
        ? '-'
        : '£' +
          (total + savedAmount * 6 + interest / 2)
              .toLocaleString()
              .split('.')[0];
}

setInterval(async () => {
    if (new Date() - lastRefresh > 1000 * 60 * 20) {
        location.reload();
    }

    if (!nextSnapshot || new Date() > nextSnapshot) {
        try {
            const response = await sendRequest('GET', './snapshot');
            const parsed = JSON.parse(response);
            nextSnapshot = new Date(parsed.nextSnapshot);
        } catch (error) {
            console.log(error);
        }
    } else {
        const timeLeft = nextSnapshot - new Date();
        const hours = Math.floor(
            (timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
        );
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

        const countdown = document.getElementById('total-snapshot');
        countdown.innerText = `Snapshot: ${hours}h ${minutes}m ${seconds}s`;
    }
}, 1000);

(async () => {
    const date = new Date();
    const startDate = new Date(date.setMonth(date.getMonth() - historyMonths));

    await fetchHistory(
        startDate.toISOString().split('T')[0],
        new Date().toISOString().split('T')[0]
    );

    await fetchSavings();
    await fetchAssets();
    await fetchIncome();
    await fetchOwed();
    await fetchCompoundInterest();

    setTotals();
})();

// Fetch data every 20 minutes.
setInterval(async () => {
    const date = new Date();
    const startDate = new Date(date.setMonth(date.getMonth() - historyMonths));

    await fetchHistory(
        startDate.toISOString().split('T')[0],
        new Date().toISOString().split('T')[0]
    );

    await fetchSavings();
    await fetchAssets();
    await fetchIncome();
    await fetchOwed();
    await fetchCompoundInterest();

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
            case 'form-compound-interest':
                handleFormSubmitCompoundInterest();
                break;
        }
    });
}
