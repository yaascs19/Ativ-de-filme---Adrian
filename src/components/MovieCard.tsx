import { useState } from 'react';
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

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white transition-colors hover:border-[#CBD5E1]">
      {/* Pôster 3:4 clicável com fallback estruturado */}
      <button
        type="button"
        onClick={() => onOpenDetail(movie)}
        className="relative aspect-[3/4] w-full overflow-hidden bg-[#0F172A] text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E11D48]"
      >
        {!imageError && movie.posterUrl ? (
          <img
            src={movie.posterUrl}
            alt={`Pôster do filme ${movie.title}`}
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#1E293B] to-[#0F172A] p-6 text-center text-white">
            <Film className="h-10 w-10 text-slate-400" aria-hidden="true" />
            <span className="mt-3 font-editorial text-lg font-semibold leading-snug">
              {movie.title}
            </span>
          </div>
        )}
      </button>

      {/* Conteúdo textual sem pílulas */}
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-[#64748B]">
          <span>{movie.genre}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{movie.year}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{movie.durationMinutes} min</span>
        </div>

        <button
          type="button"
          onClick={() => onOpenDetail(movie)}
          className="mt-1.5 text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E11D48] rounded"
        >
          <h3 className="font-display text-lg font-bold leading-snug text-[#111827] group-hover:text-[#E11D48] transition-colors">
            {movie.title}
          </h3>
        </button>

        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[#475569]">
          {movie.recommendationNote}
        </p>

        <div className="mt-3 flex items-center justify-between text-xs text-[#64748B]">
          <span className="truncate">Indicado por {movie.recommendedBy}</span>
          <span className="inline-flex items-center gap-1 font-mono font-semibold text-[#111827] tabular-nums shrink-0">
            <Star className="h-3.5 w-3.5 fill-[#F59E0B] text-[#F59E0B]" aria-hidden="true" />
            <span>{(personalRating ?? movie.rating).toFixed(1)}</span>
          </span>
        </div>

        {/* Avaliação rápida (Gostei / Não gostei) + Salvar */}
        <div className="mt-4 flex items-center gap-1.5 border-t border-[#E2E8F0] pt-3.5">
          <button
            type="button"
            onClick={() => onEvaluateMovie(movie.id, 'like')}
            aria-pressed={hasLiked}
            title="Avaliar: Gostei"
            className={`inline-flex min-h-[40px] flex-1 items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 tabular-nums cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#059669] ${
              hasLiked
                ? 'border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46]'
                : 'border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F8FAFC] hover:text-[#111827]'
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
            className={`inline-flex min-h-[40px] items-center justify-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 tabular-nums cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#DC2626] ${
              hasDisliked
                ? 'border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]'
                : 'border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F8FAFC] hover:text-[#111827]'
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
            className={`inline-flex min-h-[40px] items-center justify-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E11D48] ${
              isSaved
                ? 'border-[#CBD5E1] bg-[#F1F5F9] text-[#111827]'
                : 'border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F8FAFC] hover:text-[#111827]'
            }`}
          >
            <Bookmark
              className={`h-3.5 w-3.5 ${isSaved ? 'fill-[#111827] text-[#111827]' : ''}`}
              aria-hidden="true"
            />
            <span className="hidden xl:inline">{isSaved ? 'Salvo' : 'Salvar'}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
