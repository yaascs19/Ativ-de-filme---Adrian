import { GenreFilter, MovieGenre, PersonalPreferences, ThemePaletteId } from '../types/cinema';

export const PREFS_STORAGE_KEY = 'cineroda_dsa_2026_prefs_v1';

const VALID_GENRES: GenreFilter[] = [
  'Todos',
  'Romance',
  'Animação',
  'Ação',
  'Musical',
  'Comédia',
];

const VALID_PALETTES: ThemePaletteId[] = [
  'cinabrio',
  'cobalto',
  'esmeralda',
  'noturno',
];

function generateClientId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `user-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createDefaultPreferences(): PersonalPreferences {
  return {
    clientId: generateClientId(),
    userName: '',
    watchlistIds: [],
    personalRatings: {},
    activeGenre: 'Todos',
    palette: 'cinabrio',
  };
}

export function loadPreferencesFromStorage(): PersonalPreferences {
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) {
      return createDefaultPreferences();
    }
    const parsed = JSON.parse(raw) as Partial<PersonalPreferences>;

    const activeGenre = VALID_GENRES.includes(parsed.activeGenre as MovieGenre | 'Todos')
      ? (parsed.activeGenre as GenreFilter)
      : 'Todos';

    const palette = VALID_PALETTES.includes(parsed.palette as ThemePaletteId)
      ? (parsed.palette as ThemePaletteId)
      : 'cinabrio';

    return {
      clientId:
        typeof parsed.clientId === 'string' && parsed.clientId.length > 4
          ? parsed.clientId
          : generateClientId(),
      userName: typeof parsed.userName === 'string' ? parsed.userName.slice(0, 40) : '',
      watchlistIds: Array.isArray(parsed.watchlistIds)
        ? parsed.watchlistIds.filter((id): id is string => typeof id === 'string')
        : [],
      personalRatings:
        parsed.personalRatings && typeof parsed.personalRatings === 'object'
          ? parsed.personalRatings
          : {},
      activeGenre,
      palette,
    };
  } catch {
    return createDefaultPreferences();
  }
}

export function savePreferencesToStorage(prefs: PersonalPreferences): void {
  try {
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignora falhas de cota ou modo privado
  }
}
