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

const storageColors = localStorage.getItem('colors');

const defaultColors = {
    backgroundColor: 'rgb(160, 112, 175)',
    glass: 'rgba(17, 25, 40, 0.75)',
    glassOverlay: 'rgba(17, 25, 40, 0.05)',
    glassBorder: 'rgba(255, 255, 255, 0.125)',
    accentColor: 'rgb(160, 112, 175)',
    accentColorTransparent: 'rgba(160, 112, 175, 0.5)',
    accentColorDark: 'rgb(23, 15, 43)',
    accentColorDarkTransparent: 'rgba(23, 15, 43, 0.5)',
    accentContrast: 'rgb(255, 255, 255)',
    neutralColor: 'rgb(34, 48, 74)',
    destructiveColor: 'rgb(242, 30, 30)',
    darkTransparent20: 'rgba(0, 0, 0, 0.2)',
    darkTransparent25: 'rgba(0, 0, 0, 0.25)',
    darkTransparent30: 'rgba(0, 0, 0, 0.3)',
    darkTransparent40: 'rgba(0, 0, 0, 0.4)',
    darkTransparent50: 'rgba(0, 0, 0, 0.5)',
    bubbleUser: 'rgba(0, 0, 0, 0.5)',
    bubbleBot: 'rgba(160, 112, 175, 0.5)',
    bubbleText: 'rgb(255, 255, 255)',
};

const mainColors =
    storageColors &&
    validJSON(storageColors) &&
    colorsAreValid(JSON.parse(storageColors))
        ? JSON.parse(storageColors)
        : defaultColors;

function colorsAreValid(colors) {
    const valid =
        JSON.stringify(Object.keys(colors).sort()) ===
        JSON.stringify(Object.keys(defaultColors).sort());

    if (!valid) {
        localStorage.removeItem('colors');
    }

    return valid;
}

function setColors() {
    const rootStyle = document.getElementById('root-style');
    const colorsJson = localStorage.getItem('colors');

    if (colorsJson && validJSON(colorsJson)) {
        const colors = JSON.parse(colorsJson);

        const style = `
					:root {
						--background-color: ${colors.backgroundColor};
						--glass: ${colors.glass};
						--glass-overlay: ${colors.glassOverlay};
						--glass-border: ${colors.glassBorder};
						--accent-color: ${colors.accentColor};
						--accent-color-transparent: ${colors.accentColorTransparent};
						--accent-color-dark: ${colors.accentColorDark};
						--accent-color-dark-transparent: ${colors.accentColorDarkTransparent};
						--accent-contrast: ${colors.accentContrast};
						--neutral-color: ${colors.neutralColor};
						--destructive-color: ${colors.destructiveColor};
						--dark-transparent-20: ${colors.darkTransparent20};
						--dark-transparent-25: ${colors.darkTransparent25};
						--dark-transparent-30: ${colors.darkTransparent30};
						--dark-transparent-40: ${colors.darkTransparent40};
						--dark-transparent-50: ${colors.darkTransparent50};
						--bubble-user: ${colors.bubbleUser};
						--bubble-bot: ${colors.bubbleBot};
						--bubble-text: ${colors.bubbleText};
					}
				`;

        rootStyle.innerHTML = style;
    }
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

function hexToRgb(hex) {
    const regex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    const hexValue = hex.replace(regex, (_, r, g, b) => r + r + g + g + b + b);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hexValue);
    return `rgb(${parseInt(result[1], 16)}, ${parseInt(
        result[2],
        16
    )}, ${parseInt(result[3], 16)})`;
}

function rgbaToHex(rgb) {
    const regex = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)$/;
    const result = regex.exec(rgb);

    const r = Number(result[1]);
    const g = Number(result[2]);
    const b = Number(result[3]);

    const toHex = (number) => {
        const hex = number.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function extractRGB(color) {
    let substring;

    if (color.startsWith('rgba')) {
        substring = color
            .substring(5, color.length - 1)
            .replace(/ /g, '')
            .split(',');
    } else if (color.startsWith('rgb')) {
        substring = color
            .substring(4, color.length - 1)
            .replace(/ /g, '')
            .split(',');
    } else {
        const rgb = hexToRgb(color);
        substring = rgb
            .substring(4, rgb.length - 1)
            .replace(/ /g, '')
            .split(',');
    }

    return {
        r: Number(substring[0]),
        g: Number(substring[1]),
        b: Number(substring[2]),
        a: substring[3] ? Number(substring[3]) : 1,
    };
}

function rgbToRgba(rgb, a) {
    const { r, g, b } = extractRGB(rgb);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function validJSON(string) {
    try {
        JSON.parse(string);
    } catch (e) {
        return false;
    }
    return true;
}
