import { useCallback, useEffect, useState } from 'react';
import { Bookmark, Clock, Film, Shuffle, Sparkles, Star, X } from 'lucide-react';
import { GENRES } from '../data/posters';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { MovieGenre, MovieItem } from '../types/cinema';

interface MoviePickerModalProps {
  isOpen: boolean;
  movies: MovieItem[];
  watchlistIds: string[];
  isLoggedIn: boolean;
  onClose: () => void;
  onSelectMovie: (movie: MovieItem) => void;
  onToggleWatchlist: (movieId: string) => void;
}

type GenreChoice = 'Qualquer' | MovieGenre;
type DurationChoice = 'any' | 'short' | 'medium';
type MoodChoice = 'nota' | 'populares' | 'aleatorio';

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickRecommendations(
  movies: MovieItem[],
  watchlistIds: string[],
  genreChoice: GenreChoice,
  durationChoice: DurationChoice,
  moodChoice: MoodChoice,
  excludeSaved: boolean
): { picks: MovieItem[]; usedFallback: boolean } {
  if (movies.length === 0) return { picks: [], usedFallback: false };

  const filterPool = (
    ignoreSaved: boolean,
    ignoreDuration: boolean,
    ignoreGenre: boolean
  ) =>
    movies.filter((m) => {
      if (!ignoreSaved && excludeSaved && watchlistIds.includes(m.id)) {
        return false;
      }
      if (!ignoreGenre && genreChoice !== 'Qualquer' && m.genre !== genreChoice) {
        return false;
      }
      if (!ignoreDuration) {
        if (durationChoice === 'short' && m.durationMinutes > 110) return false;
        if (durationChoice === 'medium' && m.durationMinutes > 140) return false;
      }
      return true;
    });

  let candidates = filterPool(false, false, false);
  let usedFallback = false;

  if (candidates.length === 0) {
    candidates = filterPool(true, false, false);
    if (candidates.length > 0) usedFallback = true;
  }
  if (candidates.length === 0) {
    candidates = filterPool(true, true, false);
    if (candidates.length > 0) usedFallback = true;
  }
  if (candidates.length === 0) {
    candidates = [...movies];
    usedFallback = true;
  }

  let ordered: MovieItem[];
  if (moodChoice === 'aleatorio') {
    ordered = shuffleArray(candidates);
  } else if (moodChoice === 'populares') {
    ordered = [...candidates].sort((a, b) => {
      const scoreDiff =
        b.likedBy.length - b.dislikedBy.length - (a.likedBy.length - a.dislikedBy.length);
      if (scoreDiff !== 0) return scoreDiff;
      return b.rating - a.rating;
    });
  } else {
    ordered = [...candidates].sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating;
      return b.likedBy.length - a.likedBy.length;
    });
  }

  return { picks: ordered.slice(0, 3), usedFallback };
}

export function MoviePickerModal({
  isOpen,
  movies,
  watchlistIds,
  isLoggedIn,
  onClose,
  onSelectMovie,
  onToggleWatchlist,
}: MoviePickerModalProps) {
  const [genreChoice, setGenreChoice] = useState<GenreChoice>('Qualquer');
  const [durationChoice, setDurationChoice] = useState<DurationChoice>('any');
  const [moodChoice, setMoodChoice] = useState<MoodChoice>('nota');
  const [excludeSaved, setExcludeSaved] = useState<boolean>(true);
  const [results, setResults] = useState<MovieItem[]>([]);
  const [usedFallback, setUsedFallback] = useState<boolean>(false);

  useBodyScrollLock(isOpen);

  const runPicker = useCallback(
    (
      nextGenre: GenreChoice = genreChoice,
      nextDuration: DurationChoice = durationChoice,
      nextMood: MoodChoice = moodChoice,
      nextExcludeSaved: boolean = excludeSaved
    ) => {
      const { picks, usedFallback: fallback } = pickRecommendations(
        movies,
        watchlistIds,
        nextGenre,
        nextDuration,
        nextMood,
        isLoggedIn && nextExcludeSaved
      );
      setResults(picks);
      setUsedFallback(fallback);
    },
    [movies, watchlistIds, genreChoice, durationChoice, moodChoice, excludeSaved, isLoggedIn]
  );

  useEffect(() => {
    if (!isOpen) return;
    runPicker();
  }, [isOpen, runPicker]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSurpriseMe = () => {
    setMoodChoice('aleatorio');
    const { picks, usedFallback: fallback } = pickRecommendations(
      movies,
      watchlistIds,
      genreChoice,
      durationChoice,
      'aleatorio',
      isLoggedIn && excludeSaved
    );
    setResults(picks);
    setUsedFallback(fallback);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="picker-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#090D16]/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--cr-border)] bg-[var(--cr-surface)] p-6 shadow-2xl sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--cr-border)] pb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--cr-accent-soft)] text-[var(--cr-accent)]">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="picker-modal-title"
                className="font-display text-xl font-bold text-[var(--cr-ink)]"
              >
                Me Indica um Filme
              </h2>
              <p className="mt-1 text-xs text-[var(--cr-ink-muted)]">
                Responda 3 perguntas rápidas ou sorteie direto do catálogo da comunidade.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar recomendador"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--cr-border)] text-[var(--cr-ink-secondary)] hover:bg-[var(--cr-surface-hover)] cursor-pointer shrink-0"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* 3 perguntas rápidas */}
        <div className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          <div>
            <label
              htmlFor="picker-genre"
              className="block text-xs font-semibold text-[var(--cr-ink-secondary)]"
            >
              1. Qual gênero prefere?
            </label>
            <select
              id="picker-genre"
              value={genreChoice}
              onChange={(e) => {
                const val = e.target.value as GenreChoice;
                setGenreChoice(val);
                runPicker(val, durationChoice, moodChoice, excludeSaved);
              }}
              className="mt-1.5 min-h-[40px] w-full rounded-lg border border-[var(--cr-border-strong)] bg-[var(--cr-surface)] px-3 text-xs font-medium text-[var(--cr-ink)] focus:border-[var(--cr-accent)] focus:outline-none cursor-pointer"
            >
              <option value="Qualquer">Qualquer gênero</option>
              {GENRES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="picker-duration"
              className="block text-xs font-semibold text-[var(--cr-ink-secondary)]"
            >
              2. Quanto tempo você tem?
            </label>
            <select
              id="picker-duration"
              value={durationChoice}
              onChange={(e) => {
                const val = e.target.value as DurationChoice;
                setDurationChoice(val);
                runPicker(genreChoice, val, moodChoice, excludeSaved);
              }}
              className="mt-1.5 min-h-[40px] w-full rounded-lg border border-[var(--cr-border-strong)] bg-[var(--cr-surface)] px-3 text-xs font-medium text-[var(--cr-ink)] focus:border-[var(--cr-accent)] focus:outline-none cursor-pointer"
            >
              <option value="any">Qualquer duração</option>
              <option value="short">Curtinho (até 110 min)</option>
              <option value="medium">Médio (até 140 min)</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="picker-mood"
              className="block text-xs font-semibold text-[var(--cr-ink-secondary)]"
            >
              3. Como quer escolher?
            </label>
            <select
              id="picker-mood"
              value={moodChoice}
              onChange={(e) => {
                const val = e.target.value as MoodChoice;
                setMoodChoice(val);
                runPicker(genreChoice, durationChoice, val, excludeSaved);
              }}
              className="mt-1.5 min-h-[40px] w-full rounded-lg border border-[var(--cr-border-strong)] bg-[var(--cr-surface)] px-3 text-xs font-medium text-[var(--cr-ink)] focus:border-[var(--cr-accent)] focus:outline-none cursor-pointer"
            >
              <option value="nota">Maiores notas</option>
              <option value="populares">Mais curtidos</option>
              <option value="aleatorio">Surpreenda-me (aleatório)</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {isLoggedIn ? (
            <label className="flex items-center gap-2 text-xs text-[var(--cr-ink-secondary)] cursor-pointer">
              <input
                type="checkbox"
                checked={excludeSaved}
                onChange={(e) => {
                  const next = e.target.checked;
                  setExcludeSaved(next);
                  runPicker(genreChoice, durationChoice, moodChoice, next);
                }}
                className="h-4 w-4 rounded accent-[var(--cr-accent)]"
              />
              <span>Priorizar filmes que ainda não salvei na minha lista</span>
            </label>
          ) : (
            <span className="text-xs text-[var(--cr-ink-muted)]">
              Sugestões geradas a partir do catálogo ativo da comunidade.
            </span>
          )}

          <button
            type="button"
            onClick={handleSurpriseMe}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[var(--cr-accent-border)] bg-[var(--cr-accent-soft)] px-3.5 py-1.5 text-xs font-semibold text-[var(--cr-accent-text)] transition-colors hover:opacity-90 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Shuffle className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Sortear outros filmes</span>
          </button>
        </div>

        {usedFallback && (
          <p className="mt-3 rounded-xl border border-[var(--cr-border)] bg-[var(--cr-surface-alt)] px-3.5 py-2 text-xs text-[var(--cr-ink-secondary)]">
            Não havia combinação exata para todos os filtros — exibindo as opções mais próximas do catálogo.
          </p>
        )}

        {/* Resultados sugeridos */}
        <div className="mt-5 space-y-3">
          {results.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--cr-border-strong)] p-8 text-center text-xs text-[var(--cr-ink-muted)]">
              Nenhum filme disponível no catálogo no momento.
            </div>
          ) : (
            results.map((movie) => {
              const isSaved = isLoggedIn && watchlistIds.includes(movie.id);
              return (
                <div
                  key={movie.id}
                  className="flex flex-col gap-3.5 rounded-xl border border-[var(--cr-border)] bg-[var(--cr-surface-hover)] p-3.5 sm:flex-row sm:items-center"
                >
                  <div className="h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-[#0F172A]">
                    {movie.posterUrl ? (
                      <img
                        src={movie.posterUrl}
                        alt={`Pôster de ${movie.title}`}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-400">
                        <Film className="h-5 w-5" aria-hidden="true" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-[var(--cr-ink-muted)] tabular-nums">
                      <span className="font-semibold text-[var(--cr-accent)]">{movie.genre}</span>
                      <span aria-hidden="true">·</span>
                      <span>{movie.year}</span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        {movie.durationMinutes} min
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 font-mono font-semibold text-[var(--cr-ink)]">
                        <Star className="h-3 w-3 fill-[#F59E0B] text-[#F59E0B]" aria-hidden="true" />
                        {movie.rating.toFixed(1)}/5
                      </span>
                    </div>

                    <h3 className="mt-1 font-display text-base font-bold text-[var(--cr-ink)]">
                      {movie.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--cr-ink-secondary)]">
                      {movie.synopsis}
                    </p>
                    <p className="mt-1 truncate text-[11px] italic text-[var(--cr-ink-muted)]">
                      “{movie.recommendationNote}” — {movie.recommendedBy}
                    </p>
                  </div>

                  <div className="flex sm:flex-col items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onSelectMovie(movie);
                      }}
                      className="min-h-[38px] flex-1 sm:w-full rounded-lg bg-[var(--cr-accent)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--cr-accent-hover)] whitespace-nowrap cursor-pointer"
                    >
                      Ver detalhes
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleWatchlist(movie.id)}
                      className={`inline-flex min-h-[38px] flex-1 sm:w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold whitespace-nowrap cursor-pointer ${
                        isSaved
                          ? 'border-[var(--cr-accent-border)] bg-[var(--cr-accent-soft)] text-[var(--cr-accent-text)]'
                          : 'border-[var(--cr-border)] bg-[var(--cr-surface)] text-[var(--cr-ink-secondary)] hover:text-[var(--cr-ink)]'
                      }`}
                    >
                      <Bookmark
                        className={`h-3.5 w-3.5 ${isSaved ? 'fill-current' : ''}`}
                        aria-hidden="true"
                      />
                      <span>{isSaved ? 'Salvo' : 'Salvar'}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
