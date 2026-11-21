import { useEffect, useState } from 'react';
import { Bookmark, Film, Star, ThumbsDown, ThumbsUp } from 'lucide-react';
import { EvaluationChoice, MovieItem } from '../types/cinema';

interface MovieCardProps {
  movie: MovieItem;
  isSaved: boolean;
  hasLiked: boolean;
  hasDisliked: boolean;
  personalRating?: number;
  onToggleWatchlist: (movieId: string) => void;
  onEvaluateMovie: (movieId: string, choice: EvaluationChoice) => void;
  onOpenDetail: (movie: MovieItem) => void;
}

export function MovieCard({
  movie,
  isSaved,
  hasLiked,
  hasDisliked,
  personalRating,
  onToggleWatchlist,
  onEvaluateMovie,
  onOpenDetail,
}: MovieCardProps) {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [movie.posterUrl]);

  const totalVotes = movie.likedBy.length + movie.dislikedBy.length;
  const approvalPct =
    totalVotes > 0 ? Math.round((movie.likedBy.length / totalVotes) * 100) : 100;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl bg-[var(--cr-surface)] shadow-[0_1px_3px_rgba(15,23,42,0.06),0_12px_28px_-14px_rgba(15,23,42,0.14)] dark:border dark:border-[var(--cr-border)] transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-10px_rgba(15,23,42,0.18),0_20px_40px_-18px_rgba(15,23,42,0.16)]">
      {/* Pôster 3:4 clicável com scrim de contraste medido */}
      <button
        type="button"
        onClick={() => onOpenDetail(movie)}
        className="relative aspect-[3/4] w-full overflow-hidden bg-[#0F172A] text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cr-accent)]"
      >
        {!imageError && movie.posterUrl ? (
          <img
            src={movie.posterUrl}
            alt={`Pôster do filme ${movie.title}`}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
            className="h-full w-full object-cover transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#1E293B] to-[#0F172A] p-6 text-center text-white">
            <Film className="h-10 w-10 text-slate-400" aria-hidden="true" />
            <span className="mt-3 font-editorial text-lg font-semibold leading-snug">
              {movie.title}
            </span>
          </div>
        )}

        {/* Scrim inferior com nota e aprovação sem pílulas */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#090D16]/90 via-[#090D16]/40 to-transparent"
        />
        <div className="pointer-events-none absolute inset-x-3.5 bottom-3 flex items-center justify-between gap-2 text-xs text-white">
          <span className="inline-flex items-center gap-1 font-mono font-semibold tabular-nums">
            <Star className="h-3.5 w-3.5 fill-[#F59E0B] text-[#F59E0B]" aria-hidden="true" />
            <span>{movie.rating.toFixed(1)}</span>
            <span className="text-[11px] font-normal text-white/75">
              ({movie.ratingsCount ?? 1})
            </span>
            {personalRating !== undefined && (
              <span className="text-[11px] font-normal text-white/85">
                · sua: {personalRating.toFixed(1)}
              </span>
            )}
          </span>
          <span className="font-mono text-[11px] font-medium text-white/90 tabular-nums">
            {approvalPct}% aprovação
          </span>
        </div>
      </button>

      {/* Conteúdo textual sem pílulas */}
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-[var(--cr-ink-muted)]">
          <span className="font-semibold text-[var(--cr-accent)]">{movie.genre}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{movie.year}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{movie.durationMinutes} min</span>
        </div>

        <button
          type="button"
          onClick={() => onOpenDetail(movie)}
          className="mt-1.5 text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cr-accent)] rounded"
        >
          <h3 className="font-display text-lg font-bold leading-snug text-[var(--cr-ink)] group-hover:text-[var(--cr-accent)] transition-colors">
            {movie.title}
          </h3>
        </button>

        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--cr-ink-secondary)]">
          {movie.recommendationNote}
        </p>

        <p className="mt-auto pt-3 text-xs text-[var(--cr-ink-muted)] truncate">
          Indicado por{' '}
          <span className="font-medium text-[var(--cr-ink-secondary)]">
            {movie.recommendedBy}
          </span>
        </p>

        {/* Avaliação rápida (Gostei / Não gostei) + Salvar */}
        <div className="mt-3.5 flex items-center gap-1.5 border-t border-[var(--cr-border)] pt-3.5">
          <button
            type="button"
            onClick={() => onEvaluateMovie(movie.id, 'like')}
            aria-pressed={hasLiked}
            title="Avaliar: Gostei"
            className={`inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 tabular-nums cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#059669] ${
              hasLiked
                ? 'border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46] dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'border-[var(--cr-border)] bg-[var(--cr-surface-hover)] text-[var(--cr-ink-secondary)] hover:bg-[var(--cr-surface)] hover:text-[var(--cr-ink)]'
            }`}
          >
            <ThumbsUp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Gostei</span>
            <span className="font-mono text-[11px]">{movie.likedBy.length}</span>
          </button>

          <button
            type="button"
            onClick={() => onEvaluateMovie(movie.id, 'dislike')}
            aria-pressed={hasDisliked}
            title="Avaliar: Não gostei"
            className={`inline-flex min-h-[40px] items-center justify-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 tabular-nums cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#DC2626] ${
              hasDisliked
                ? 'border-[#FECACA] bg-[#FEF2F2] text-[#991B1B] dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                : 'border-[var(--cr-border)] bg-[var(--cr-surface-hover)] text-[var(--cr-ink-secondary)] hover:bg-[var(--cr-surface)] hover:text-[var(--cr-ink)]'
            }`}
          >
            <ThumbsDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="font-mono text-[11px]">{movie.dislikedBy.length}</span>
          </button>

          <button
            type="button"
            onClick={() => onToggleWatchlist(movie.id)}
            aria-pressed={isSaved}
            title={isSaved ? 'Salvo na Minha Lista' : 'Salvar na Minha Lista'}
            className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cr-accent)] ${
              isSaved
                ? 'border-[var(--cr-accent)] bg-[var(--cr-accent)] text-white'
                : 'border-[var(--cr-border)] bg-[var(--cr-surface-hover)] text-[var(--cr-ink-secondary)] hover:bg-[var(--cr-surface)] hover:text-[var(--cr-ink)]'
            }`}
          >
            <Bookmark
              className={`h-3.5 w-3.5 ${isSaved ? 'fill-white text-white' : ''}`}
              aria-hidden="true"
            />
            <span className="hidden xl:inline">{isSaved ? 'Salvo' : 'Salvar'}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
