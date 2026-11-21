export type MovieGenre =
  | 'Romance'
  | 'Animação'
  | 'Ação'
  | 'Musical'
  | 'Comédia';

export type GenreFilter = 'Todos' | MovieGenre;

export type NavSection = 'catalogo' | 'lista' | 'sobre';

export type EvaluationChoice = 'like' | 'dislike';

export type ThemePaletteId = 'cinabrio' | 'cobalto' | 'esmeralda' | 'noturno';

export interface MovieComment {
  id: string;
  movieId: string;
  userKey: string;
  author: string;
  text: string;
  createdAt: number;
}

export interface MovieItem {
  id: string;
  title: string;
  director: string;
  year: number;
  durationMinutes: number;
  genre: MovieGenre;
  synopsis: string;
  recommendedBy: string;
  ownerUserKey?: string;
  recommendationNote: string;
  posterUrl: string;
  rating: number;
  authorRating?: number;
  ratingsCount: number;
  likedBy: string[];
  dislikedBy: string[];
  comments: MovieComment[];
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  userKey?: string;
  author: string;
  text: string;
  attachedMovieId?: string;
  createdAt: number;
}

export interface AuthUser {
  id: string;
  userKey: string;
  name: string;
  email: string;
  createdAt: number;
}

export interface UserActivity {
  watchlistIds: string[];
  personalRatings: Record<string, number>;
  palette: ThemePaletteId;
}

export interface PersonalPreferences {
  clientId: string;
  userName: string;
  watchlistIds: string[];
  personalRatings: Record<string, number>;
  activeGenre: GenreFilter;
  palette: ThemePaletteId;
}
