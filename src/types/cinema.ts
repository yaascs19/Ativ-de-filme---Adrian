export type MovieGenre =
  | 'Romance'
  | 'Animação'
  | 'Ação'
  | 'Musical'
  | 'Comédia';

export type GenreFilter = 'Todos' | MovieGenre;

export type NavSection = 'catalogo' | 'lista' | 'sobre';

export type EvaluationChoice = 'like' | 'dislike';

export interface MovieItem {
  id: string;
  title: string;
  director: string;
  year: number;
  durationMinutes: number;
  genre: MovieGenre;
  synopsis: string;
  recommendedBy: string;
  recommendationNote: string;
  posterUrl: string;
  rating: number;
  likedBy: string[];
  dislikedBy: string[];
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  author: string;
  text: string;
  attachedMovieId?: string;
  createdAt: number;
}

export interface PersonalPreferences {
  clientId: string;
  userName: string;
  watchlistIds: string[];
  personalRatings: Record<string, number>;
  activeGenre: GenreFilter;
}
