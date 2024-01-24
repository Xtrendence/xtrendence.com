function messageToHtml(message) {
    if (!message) return null;

    const lines = message.split('\n');
    const afterLines = lines
        .map((line) => `<p>${line.replace(/\*([^*]+?)\*/g, '<b>$1</b>')}</p>`)
        .join('<div class="break"></div>');

    const links = afterLines.match(/(https?:\/\/[^\s]+)/g);
    const afterLinks = links
        ? links.reduce(
              (acc, link) =>
                  acc.replace(
                      link,
                      `<a href="${link}" target="_blank">${link}</a>`
                  ),
              afterLines
          )
        : afterLines;

    return afterLinks;
}

function sortMessages(messages) {
    return messages.sort((a, b) => {
        const aTimestamp = Number(a.id.split('-')[0]);
        const bTimestamp = Number(b.id.split('-')[0]);
        return new Date(aTimestamp).getTime() - new Date(bTimestamp).getTime();
    });
}

function getCookie(cookie) {
    try {
        const name = cookie + '=';
        const decodedCookie = decodeURIComponent(document.cookie);
        const parts = decodedCookie.split(';');

        for (let i = 0; i < parts.length; i++) {
            let value = parts[i];

            while (value.charAt(0) === ' ') {
                value = value.substring(1);
            }

            if (value.indexOf(name) === 0) {
                return value.substring(name.length, value.length);
            }
        }

        return '';
    } catch (e) {
        return '';
    }
}
