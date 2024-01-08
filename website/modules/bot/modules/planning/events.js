import { getOrdinal } from '../../utils/utils.js';

export function getDate() {
    const months = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
    ];

    const date = new Date();
    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();

    return `It's the ${day}${getOrdinal(day)} of ${months[month]}, ${year}.`;
}

export function userBirthday() {
    const current = new Date();
    const birthday = new Date(`${current.getFullYear()}-09-24`);
    const today = new Date();
    const daysLeft = Math.ceil((birthday - today) / (1000 * 60 * 60 * 24));
    return `There are ${daysLeft} days left until your birthday.`;
}
