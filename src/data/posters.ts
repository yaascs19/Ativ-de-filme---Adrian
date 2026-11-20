import { MovieGenre } from '../types/cinema';

export const GENRES: MovieGenre[] = [
  'Romance',
  'Animação',
  'Ação',
  'Musical',
  'Comédia',
];

export interface PosterPreset {
  id: string;
  label: string;
  genre: MovieGenre;
  url: string;
}

export const POSTER_PRESETS: PosterPreset[] = [
  {
    id: 'filme1',
    label: 'Como Eu Era Antes de Você',
    genre: 'Romance',
    url: '/assets/aistudio/filme1_a0effce9.jpg',
  },
  {
    id: 'filme2',
    label: 'O Pequeno Príncipe',
    genre: 'Animação',
    url: '/assets/aistudio/filme2_ba15de3e.jpg',
  },
  {
    id: 'filme3',
    label: 'Homem-Aranha: Um Novo Dia',
    genre: 'Ação',
    url: '/assets/aistudio/filme3_f5e4cc7c.jpg',
  },
  {
    id: 'filme4',
    label: 'Sing',
    genre: 'Animação',
    url: '/assets/aistudio/filme4_7f9fb5f4.jpg',
  },
  {
    id: 'filme5',
    label: 'Wicked',
    genre: 'Musical',
    url: '/assets/aistudio/filme8_195fa374.jpg',
  },
  {
    id: 'filme6',
    label: 'Minha Melhor Amiga',
    genre: 'Comédia',
    url: '/assets/aistudio/filme6_6b1c72a1.jpg',
  },
];

export function getDefaultPosterForGenre(genre: MovieGenre): string {
  const match = POSTER_PRESETS.find((item) => item.genre === genre);
  return match ? match.url : POSTER_PRESETS[0].url;
}
