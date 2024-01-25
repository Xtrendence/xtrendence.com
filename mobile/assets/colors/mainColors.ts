import { MMKV } from 'react-native-mmkv';
import { validJSON } from '../../utils/utils';

const storage = new MMKV();
const colors = storage.getString('colors') || '';

export type MainColor =
  | 'background'
  | 'glass'
  | 'glassLessTransparent'
  | 'glassOpaque'
  | 'glassOverlay'
  | 'darkPurple'
  | 'darkTransparent20'
  | 'darkTransparent40'
  | 'darkTransparent50'
  | 'accent'
  | 'accentTransparent'
  | 'accentDark'
  | 'accentDarkTransparent'
  | 'accentContrast'
  | 'accentContrastTransparent'
  | 'accentContrastMoreTransparent'
  | 'accentContrastDark'
  | 'bubbleUser'
  | 'bubbleBot'
  | 'bubbleText'
  | 'red';

export type MainColors = Record<MainColor, string>;

const defaultColors: MainColors = {
  background: 'rgb(160, 112, 175)',
  glass: 'rgba(17, 25, 40, 0.65)',
  glassLessTransparent: 'rgba(17, 25, 40, 0.7)',
  glassOpaque: 'rgb(17, 25, 40)',
  glassOverlay: 'rgba(17, 25, 40, 0.25)',
  darkPurple: '#302549',
  darkTransparent20: 'rgba(0, 0, 0, 0.2)',
  darkTransparent40: 'rgba(0, 0, 0, 0.4)',
  darkTransparent50: 'rgba(0, 0, 0, 0.5)',
  accent: 'rgb(160, 112, 175)',
  accentTransparent: 'rgba(160, 112, 175, 0.5)',
  accentDark: 'rgb(23, 15, 43)',
  accentDarkTransparent: 'rgba(23, 15, 43, 0.5)',
  accentContrast: 'rgb(255, 255, 255)',
  accentContrastTransparent: 'rgba(255, 255, 255, 0.5)',
  accentContrastMoreTransparent: 'rgba(255, 255, 255, 0.125)',
  accentContrastDark: 'rgb(220, 220, 220)',
  bubbleUser: 'rgba(0, 0, 0, 0.5)',
  bubbleBot: 'rgba(160, 112, 175, 0.5)',
  bubbleText: 'rgb(255, 255, 255)',
  red: 'rgb(200, 40, 40)',
};

export function colorsAreValid(json?: string) {
  if (!json || !validJSON(json)) {
    storage.set('colors', JSON.stringify(defaultColors));
    return false;
  }

  const parsedColors = JSON.parse(json);
  const colorKeys = Object.keys(parsedColors).sort();
  const defaultColorKeys = Object.keys(defaultColors).sort();

  const match = colorKeys.join(',') === defaultColorKeys.join(',');

  if (!match) {
    storage.set('colors', JSON.stringify(defaultColors));
    return false;
  }

  return true;
}

export const mainColors: MainColors = colorsAreValid(colors)
  ? JSON.parse(colors)
  : defaultColors;

export function rgbToHex(color: string) {
  const rgb = color.replace(/[^\d,]/g, '').split(',');
  const r = parseInt(rgb[0], 10);
  const g = parseInt(rgb[1], 10);
  const b = parseInt(rgb[2], 10);

  return `#${r.toString(16)}${g.toString(16)}${b.toString(16)}`;
}
