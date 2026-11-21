import { ThemePaletteId } from '../types/cinema';

export interface ThemePaletteOption {
  id: ThemePaletteId;
  label: string;
  canvasColor: string;
  accentColor: string;
  isDark: boolean;
}

export const THEME_PALETTES: ThemePaletteOption[] = [
  {
    id: 'cinabrio',
    label: 'Clássico',
    canvasColor: '#F7F8FA',
    accentColor: '#E11D48',
    isDark: false,
  },
  {
    id: 'cobalto',
    label: 'Azul',
    canvasColor: '#F5F7FB',
    accentColor: '#2563EB',
    isDark: false,
  },
  {
    id: 'esmeralda',
    label: 'Esmeralda',
    canvasColor: '#F4F7F5',
    accentColor: '#059669',
    isDark: false,
  },
  {
    id: 'noturno',
    label: 'Escuro',
    canvasColor: '#090D16',
    accentColor: '#E11D48',
    isDark: true,
  },
];
