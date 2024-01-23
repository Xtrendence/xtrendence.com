export function requiresHtmlConversion(string: string) {
  return /https?:\/\/[^\s]+|\*[^\*]+\*/.test(string);
}

export function messageToHtml(
  message: string,
  style: {
    div: string;
    p: string;
    a: string;
  },
) {
  const lines = message.split('\n');
  const afterLines = lines
    .map(
      line =>
        `<p style="${style.p}">${line.replace(
          /\*([^*]+?)\*/g,
          '<b>$1</b>',
        )}</p>`,
    )
    .join('<div class="break"></div>');

  const links = afterLines.match(/(https?:\/\/[^\s]+)/g);
  const afterLinks = links
    ? links.reduce(
        (acc, link) =>
          acc.replace(
            link,
            `<a style="${style.a}" href="${link}" target="_blank">${link}</a>`,
          ),
        afterLines,
      )
    : afterLines;

  return `<div style="${style.div}">${afterLinks}</div>`;
}

export function wait(time: number) {
  return new Promise(resolve => {
    setTimeout(resolve, time);
  });
}

export function validJSON(string: string) {
  try {
    JSON.parse(string);
  } catch (e) {
    return false;
  }
  return true;
}
