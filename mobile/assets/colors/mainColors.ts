export const mainColors = {
  glass: 'rgba(17, 25, 40, 0.65)',
  glassLessTransparent: 'rgba(17, 25, 40, 0.7)',
  glassOverlay: 'rgba(17, 25, 40, 0.25)',
  darkPurple: '#302549',
  accent: 'rgb(160, 112, 175)',
  accentTransparent: 'rgba(160, 112, 175, 0.5)',
  accentDark: 'rgb(23, 15, 43)',
  accentDarkTransparent: 'rgba(23, 15, 43, 0.5)',
  accentContrast: 'rgb(255, 255, 255)',
  accentContrastTransparent: 'rgba(255, 255, 255, 0.5)',
  accentContrastMoreTransparent: 'rgba(255, 255, 255, 0.125)',
  accentContrastDark: 'rgb(220, 220, 220)',
  red: 'rgb(200, 40, 40)',
};

export function rgbToHex(color: string) {
  const rgb = color.replace(/[^\d,]/g, '').split(',');
  const r = parseInt(rgb[0], 10);
  const g = parseInt(rgb[1], 10);
  const b = parseInt(rgb[2], 10);

  return `#${r.toString(16)}${g.toString(16)}${b.toString(16)}`;
}
