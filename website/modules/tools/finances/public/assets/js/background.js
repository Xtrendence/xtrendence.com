const colors = {
    red: [
        '#23001220',
        '#23fa7268',
        '#23ef5f67',
        '#23e34c67',
        '#23d53867',
        '#23c62368',
        'rgb(198, 35, 104)',
        'rgb(250, 114, 104)',
        'rgb(244, 194, 108)',
        'rgb(232, 88, 63)',
    ],
    purple: [
        '#23001220',
        '#236075c4',
        '#235d63aa',
        '#23575290',
        '#234e4277',
        '#23443260',
        'rgb(68, 50, 96)',
        'rgb(96, 117, 196)',
        'rgb(167, 110, 237)',
        'rgb(121, 22, 242)',
    ],
    pink: [
        '#23001220',
        '#2365556e',
        '#2374637d',
        '#2383728d',
        '#2392819d',
        '#23a290ad',
        'rgb(162, 144, 173)',
        'rgb(131, 114, 141)',
        'rgb(211, 102, 228)',
        'rgb(214, 53, 133)',
    ],
};

const lastColor = localStorage.getItem('lastColor');
if (Object.keys(colors).includes(lastColor)) {
    delete colors[lastColor];
}

const colored = false;
const index = Math.floor(Math.random() * Object.keys(colors).length);
const color = Object.keys(colors)[index];

localStorage.setItem('lastColor', color);

const backgroundColor = colored ? colors[color][6] : '#001220';

document.head.innerHTML += '<style id="root-style"></style>';

const accentColor = colors[color][6];
const accentColorDark = colors[color][7];
const chartUp = colors[color][8];
const chartDown = colors[color][9];
document.getElementById('root-style').innerHTML = `
	:root {
		--accent-color: ${accentColor};
		--accent-color-dark: ${accentColorDark};
		--accent-color-transparent: ${accentColor
            .replace('rgb', 'rgba')
            .replace(')', ', 0.5)')};
		--chart-up: ${chartUp};
		--chart-down: ${chartDown};
	}
`;

document.body
    .getElementsByClassName('wrapper')[0]
    .setAttribute(
        'style',
        `background-color: ${backgroundColor}; background-image: url("data:image/svg+xml,%0A%3Csvg id='visual' viewBox='0 0 900 600' width='900' height='600' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' version='1.1'%3E%3Crect x='0' y='0' width='900' height='600' fill='${colors[
            color
        ][0].replace(
            '#',
            '%'
        )}'%3E%3C/rect%3E%3Cpath d='M0 373L21.5 385.2C43 397.3 86 421.7 128.8 421C171.7 420.3 214.3 394.7 257.2 387.8C300 381 343 393 385.8 395.5C428.7 398 471.3 391 514.2 386C557 381 600 378 642.8 380.3C685.7 382.7 728.3 390.3 771.2 386.5C814 382.7 857 367.3 878.5 359.7L900 352L900 601L878.5 601C857 601 814 601 771.2 601C728.3 601 685.7 601 642.8 601C600 601 557 601 514.2 601C471.3 601 428.7 601 385.8 601C343 601 300 601 257.2 601C214.3 601 171.7 601 128.8 601C86 601 43 601 21.5 601L0 601Z' fill='${colors[
            color
        ][1].replace(
            '#',
            '%'
        )}'%3E%3C/path%3E%3Cpath d='M0 469L21.5 465.3C43 461.7 86 454.3 128.8 447C171.7 439.7 214.3 432.3 257.2 430.2C300 428 343 431 385.8 439.3C428.7 447.7 471.3 461.3 514.2 466.3C557 471.3 600 467.7 642.8 458C685.7 448.3 728.3 432.7 771.2 422.3C814 412 857 407 878.5 404.5L900 402L900 601L878.5 601C857 601 814 601 771.2 601C728.3 601 685.7 601 642.8 601C600 601 557 601 514.2 601C471.3 601 428.7 601 385.8 601C343 601 300 601 257.2 601C214.3 601 171.7 601 128.8 601C86 601 43 601 21.5 601L0 601Z' fill='${colors[
            color
        ][2].replace(
            '#',
            '%'
        )}'%3E%3C/path%3E%3Cpath d='M0 482L21.5 479.3C43 476.7 86 471.3 128.8 470.3C171.7 469.3 214.3 472.7 257.2 475C300 477.3 343 478.7 385.8 474.7C428.7 470.7 471.3 461.3 514.2 457.3C557 453.3 600 454.7 642.8 458.7C685.7 462.7 728.3 469.3 771.2 471.3C814 473.3 857 470.7 878.5 469.3L900 468L900 601L878.5 601C857 601 814 601 771.2 601C728.3 601 685.7 601 642.8 601C600 601 557 601 514.2 601C471.3 601 428.7 601 385.8 601C343 601 300 601 257.2 601C214.3 601 171.7 601 128.8 601C86 601 43 601 21.5 601L0 601Z' fill='${colors[
            color
        ][3].replace(
            '#',
            '%'
        )}'%3E%3C/path%3E%3Cpath d='M0 521L21.5 516.7C43 512.3 86 503.7 128.8 503C171.7 502.3 214.3 509.7 257.2 513.2C300 516.7 343 516.3 385.8 513C428.7 509.7 471.3 503.3 514.2 506.8C557 510.3 600 523.7 642.8 523.7C685.7 523.7 728.3 510.3 771.2 503.8C814 497.3 857 497.7 878.5 497.8L900 498L900 601L878.5 601C857 601 814 601 771.2 601C728.3 601 685.7 601 642.8 601C600 601 557 601 514.2 601C471.3 601 428.7 601 385.8 601C343 601 300 601 257.2 601C214.3 601 171.7 601 128.8 601C86 601 43 601 21.5 601L0 601Z' fill='${colors[
            color
        ][4].replace(
            '#',
            '%'
        )}'%3E%3C/path%3E%3Cpath d='M0 573L21.5 568.5C43 564 86 555 128.8 551.8C171.7 548.7 214.3 551.3 257.2 554.2C300 557 343 560 385.8 557C428.7 554 471.3 545 514.2 541C557 537 600 538 642.8 537C685.7 536 728.3 533 771.2 535.3C814 537.7 857 545.3 878.5 549.2L900 553L900 601L878.5 601C857 601 814 601 771.2 601C728.3 601 685.7 601 642.8 601C600 601 557 601 514.2 601C471.3 601 428.7 601 385.8 601C343 601 300 601 257.2 601C214.3 601 171.7 601 128.8 601C86 601 43 601 21.5 601L0 601Z' fill='${colors[
            color
        ][5].replace('#', '%')}'%3E%3C/path%3E%3C/svg%3E")`
    );
