async function fetchHistory(start, end) {
    const history = await sendRequest(
        'GET',
        `./history?start=${start}&end=${end}`
    );

    const parsed = JSON.parse(history);

    const ctx = document.getElementById('chart').getContext('2d');
    ctx.canvas.width = 1200;
    ctx.canvas.height = 400;

    const data = parsed.map((day) => {
        const totals = day.map((d) => d.total);
        const sortByDate = day.sort(
            (a, b) => new Date(a.date) - new Date(b.date)
        );

        return {
            x: Date.parse(sortByDate[0].date).valueOf(),
            o: day[0].total,
            h: Math.max(...totals),
            l: Math.min(...totals),
            c: sortByDate[sortByDate.length - 1].total,
        };
    });

    const style = getComputedStyle(
        document.getElementsByClassName('wrapper')[0]
    );
    const chartUp = style.getPropertyValue('--chart-up');
    const chartDown = style.getPropertyValue('--chart-down');

    const chart = new Chart(ctx, {
        type: 'candlestick',
        options: {
            plugins: {
                legend: {
                    display: false,
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const { x, o, h, l, c } = context.parsed;

                            return ` Open: £${o?.toLocaleString()} \nHigh: £${h?.toLocaleString()} \nLow: £${l?.toLocaleString()} \nClose: £${c?.toLocaleString()}`;
                        },
                    },
                },
            },
            scales: {
                x: {
                    ticks: {
                        color: '#ffffff',
                        callback: function (value, index, ticks) {
                            const month = getMonthName(
                                new Date(value).getMonth()
                            );

                            if (new Date(value).getDate() === 1) {
                                return month;
                            }
                        },
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.25)',
                    },
                },
                y: {
                    ticks: {
                        color: '#ffffff',
                        callback: function (value, index, ticks) {
                            return '£' + value?.toLocaleString();
                        },
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                    },
                },
            },
            responsive: true,
        },
        data: {
            datasets: [
                {
                    label: 'Performance',
                    data,
                    borderColor: 'rgba(255, 255, 255, 0.75)',
                    color: {
                        up: chartUp,
                        down: chartDown,
                        unchanged: '#ffffff',
                    },
                },
            ],
        },
    });

    chart.update();

    const chartWrapper = document.getElementsByClassName('chart-wrapper')[0];

    chartWrapper.scrollLeft = chartWrapper.getBoundingClientRect().width;
}
