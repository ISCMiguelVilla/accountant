/**
 * Chart colors per mode. Series slots come from the validated reference palette (aqua / orange / blue,
 * stepped separately for the dark surface); text and grid stay neutral so data ink carries the color.
 * Income is light-mode aqua (< 3:1 on the light surface): the cards offer a table view as relief.
 */
export interface ChartTheme {
  income: string;
  expense: string;
  net: string;
  fees: string;
  text: string;
  muted: string;
  grid: string;
  surface: string;
}

const LIGHT: ChartTheme = {
  income: '#1baf7a',
  expense: '#eb6834',
  net: '#2a78d6',
  fees: '#8a8985',
  text: '#0b0b0b',
  muted: '#52514e',
  grid: 'rgba(11, 11, 11, 0.08)',
  surface: '#ffffff',
};

const DARK: ChartTheme = {
  income: '#199e70',
  expense: '#d95926',
  net: '#3987e5',
  fees: '#8a8985',
  text: '#f0efec',
  muted: '#c3c2b7',
  grid: 'rgba(240, 239, 236, 0.1)',
  surface: '#18181b',
};

export function chartTheme(dark: boolean): ChartTheme {
  return dark ? DARK : LIGHT;
}
