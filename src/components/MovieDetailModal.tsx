import { useEffect, useState } from 'react';
import {
  Bookmark,
  Film,
  MessageSquarePlus,
  Star,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react';
import { EvaluationChoice, MovieItem } from '../types/cinema';

interface MovieDetailModalProps {
  movie: MovieItem | null;
  isSaved: boolean;
  hasLiked: boolean;
  hasDisliked: boolean;
  personalRating?: number;
  onClose: () => void;
  onToggleWatchlist: (movieId: string) => void;
  onEvaluateMovie: (movieId: string, choice: EvaluationChoice) => void;
  onRateMovie: (movieId: string, rating: number) => void;
  onRecommendInChat: (movie: MovieItem) => void;
}

export function MovieDetailModal({
  movie,
  isSaved,
  hasLiked,
  hasDisliked,
  personalRating,
  onClose,
  onToggleWatchlist,
  onEvaluateMovie,
  onRateMovie,
  onRecommendInChat,
}: MovieDetailModalProps) {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [movie?.id]);

  useEffect(() => {
    if (!movie) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [movie, onClose]);

  if (!movie) return null;

  const totalVotes = movie.likedBy.length + movie.dislikedBy.length;
  const approvalPct =
    totalVotes > 0 ? Math.round((movie.likedBy.length / totalVotes) * 100) : 100;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="movie-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/70 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#E2E8F0] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar detalhes do filme"
          className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#475569] transition-colors hover:bg-[#F8FAFC] hover:text-[#111827] cursor-pointer"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-12">
          <div className="md:col-span-5 bg-[#0F172A]">
            {!imageError && movie.posterUrl ? (
              <img
                src={movie.posterUrl}
                alt={`Pôster de ${movie.title}`}
                referrerPolicy="no-referrer"
                onError={() => setImageError(true)}
                className="aspect-[3/4] h-full w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[3/4] h-full w-full flex-col items-center justify-center p-6 text-center text-white">
                <Film className="h-12 w-12 text-slate-400" aria-hidden="true" />
                <span className="mt-3 font-editorial text-xl font-semibold">
                  {movie.title}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col justify-between p-6 sm:p-7 md:col-span-7">
            <div>
              <div className="flex flex-wrap items-center gap-2 pr-10 text-xs font-medium text-[#64748B]">
                <span>{movie.genre}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{movie.year}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{movie.durationMinutes} min</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-[#059669] tabular-nums">
                  {approvalPct}% aprovação
                </span>
              </div>

              <h2
                id="movie-modal-title"
                className="mt-2 font-display text-2xl font-bold tracking-tight text-[#111827] sm:text-3xl"
              >
                {movie.title}
              </h2>
              <p className="mt-1 text-sm text-[#64748B]">Direção: {movie.director}</p>

              <p className="mt-4 text-sm leading-relaxed text-[#334155]">
                {movie.synopsis}
              </p>

              <div className="mt-5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                <p className="text-xs font-semibold text-[#111827]">
                  Indicado por {movie.recommendedBy}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-[#475569]">
                  “{movie.recommendationNote}”
                </p>
              </div>

              {/* Avaliação Gostei / Não gostei + Estrelas */}
              <div className="mt-5 border-t border-[#E2E8F0] pt-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#334155]">
                    Você gostou deste filme?
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onEvaluateMovie(movie.id, 'like')}
                      aria-pressed={hasLiked}
                      className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors tabular-nums cursor-pointer ${
                        hasLiked
                          ? 'border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46]'
                          : 'border-[#E2E8F0] bg-white text-[#334155] hover:bg-[#F8FAFC]'
                      }`}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Gostei ({movie.likedBy.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onEvaluateMovie(movie.id, 'dislike')}
                      aria-pressed={hasDisliked}
                      className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors tabular-nums cursor-pointer ${
                        hasDisliked
                          ? 'border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]'
                          : 'border-[#E2E8F0] bg-white text-[#334155] hover:bg-[#F8FAFC]'
                      }`}
                    >
                      <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Não gostei ({movie.dislikedBy.length})</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <span className="text-xs font-semibold text-[#475569]">
                    Sua nota (1 a 5 estrelas)
                  </span>
                  <span className="font-mono text-xs text-[#64748B] tabular-nums">
                    Média: {movie.rating.toFixed(1)}/5
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((value) => {
                    const active = (personalRating ?? 0) >= value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => onRateMovie(movie.id, value)}
                        aria-label={`Avaliar com ${value} estrelas`}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white transition-colors hover:border-[#F59E0B] cursor-pointer"
                      >
                        <Star
                          className={`h-4 w-4 ${
                            active ? 'fill-[#F59E0B] text-[#F59E0B]' : 'text-[#CBD5E1]'
                          }`}
                          aria-hidden="true"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2.5 border-t border-[#E2E8F0] pt-5">
              <button
                type="button"
                onClick={() => onToggleWatchlist(movie.id)}
                className={`inline-flex min-h-[42px] items-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isSaved
                    ? 'border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46]'
                    : 'border-[#E2E8F0] bg-white text-[#111827] hover:bg-[#F8FAFC]'
                }`}
              >
                <Bookmark
                  className={`h-4 w-4 ${isSaved ? 'fill-[#059669] text-[#059669]' : ''}`}
                  aria-hidden="true"
                />
                <span>{isSaved ? 'Salvo na Lista' : 'Salvar na Lista'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onRecommendInChat(movie);
                  onClose();
                }}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#E11D48] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#BE123C] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
                <span>Indicar no Chat</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
