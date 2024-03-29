function daysInThisMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

function getMonthName(month) {
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

  return months[month];
}

// TODO: Add encryption
function sendRequest(method, url, body) {
  const exclusions = ['./snapshot'];

  if (!exclusions.includes(url)) {
    const loading = document.getElementById('loading');

    loading.classList.remove('hidden');
  }

  let xhr = new XMLHttpRequest();

  return new Promise((resolve, reject) => {
    xhr.addEventListener('readystatechange', () => {
      setTimeout(() => {
        loading.classList.add('hidden');
      }, 250);

      if (xhr.readyState !== 4) return;
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.responseText);
      } else {
        reject();
      }
    });

    xhr.open(method, url, true);
    xhr.send(body);
  });
}
