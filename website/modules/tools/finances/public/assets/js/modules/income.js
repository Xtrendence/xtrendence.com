document.getElementById('unpaid-income').addEventListener('click', () => {
  const includeUnpaidIncome =
    localStorage.getItem('includeUnpaidIncome') === 'true';

  if (includeUnpaidIncome) {
    localStorage.setItem('includeUnpaidIncome', 'false');
  } else {
    localStorage.setItem('includeUnpaidIncome', 'true');
  }
});

async function fetchIncome() {
  try {
    const income = await sendRequest('GET', './income');

    const parsed = JSON.parse(income);

    if (!parsed.yearly || !parsed.saved) {
      return;
    }

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

// Calculates the amount of money earned in the current month. Does not take into account the number of work days or anything else. Just the amount earned per second multiplied by the number of seconds elapsed in the current month.
setInterval(() => {
  const unpaidIncome = document.getElementById('unpaid-income');

  try {
    const form = document.getElementById('form-income');
    const yearly = parseFloat(form.getElementsByTagName('input')[0].value);

    if (isNaN(yearly)) {
      throw new Error('Invalid input');
    }

    const daily = yearly / 365;
    const hourly = daily / 24;
    const minute = hourly / 60;
    const second = minute / 60;

    const secondsInADay = 86400;
    const secondsInThisMonth = secondsInADay * daysInThisMonth();

    const max = secondsInThisMonth * second;

    const now = new Date();
    const dayOne = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const distance = now - dayOne;
    const totalSeconds = Math.floor(distance / 1000);

    const currentTotal = second * totalSeconds;

    const limited = currentTotal > max ? max : currentTotal;

    unpaidIncome.setAttribute('data-current', limited.toFixed(3));
    unpaidIncome.innerText = `£${limited.toFixed(3)} / £${max.toFixed(0)}`;

    setTotals();
  } catch (error) {
    unpaidIncome.innerText = `£0.00`;
  }
}, 1000);

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
