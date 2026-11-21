import { FormEvent, useEffect, useState } from 'react';
import {
  Bookmark,
  Film,
  MessageSquarePlus,
  Pencil,
  Send,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from 'lucide-react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { AuthUser, EvaluationChoice, MovieItem } from '../types/cinema';

interface MovieDetailModalProps {
  movie: MovieItem | null;
  authUser: AuthUser | null;
  isSaved: boolean;
  hasLiked: boolean;
  hasDisliked: boolean;
  personalRating?: number;
  onClose: () => void;
  onToggleWatchlist: (movieId: string) => void;
  onEvaluateMovie: (movieId: string, choice: EvaluationChoice) => void;
  onRateMovie: (movieId: string, rating: number | null) => void;
  onRecommendInChat: (movie: MovieItem) => void;
  onEditMovie: (movie: MovieItem) => void;
  onDeleteMovie: (movieId: string) => Promise<void>;
  onAddComment: (movieId: string, text: string) => Promise<boolean>;
  onDeleteComment: (movieId: string, commentId: string) => Promise<void>;
  onOpenAuthModal: (reason: string) => void;
}

function formatCommentDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function MovieDetailModal({
  movie,
  authUser,
  isSaved,
  hasLiked,
  hasDisliked,
  personalRating,
  onClose,
  onToggleWatchlist,
  onEvaluateMovie,
  onRateMovie,
  onRecommendInChat,
  onEditMovie,
  onDeleteMovie,
  onAddComment,
  onDeleteComment,
  onOpenAuthModal,
}: MovieDetailModalProps) {
  const [imageError, setImageError] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletingMovie, setDeletingMovie] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

  useBodyScrollLock(Boolean(movie));

  useEffect(() => {
    setImageError(false);
    setConfirmingDelete(false);
    setDeletingMovie(false);
    setCommentText('');
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
  const ratingsCount = movie.ratingsCount ?? 1;
  const comments = movie.comments ?? [];
  const isOwner = Boolean(
    authUser && movie.ownerUserKey && authUser.userKey === movie.ownerUserKey
  );

  const handleStarClick = (value: number) => {
    if (!isOwner && personalRating === value) {
      onRateMovie(movie.id, null);
      return;
    }
    onRateMovie(movie.id, value);
  };

  const handleConfirmDelete = async () => {
    if (deletingMovie) return;
    setDeletingMovie(true);
    await onDeleteMovie(movie.id);
    setDeletingMovie(false);
  };

  const handleSubmitComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!authUser) {
      onOpenAuthModal('Entre na sua conta para comentar sobre este filme.');
      return;
    }
    const clean = commentText.trim();
    if (clean.length < 2 || sendingComment) return;

    setSendingComment(true);
    const ok = await onAddComment(movie.id, clean);
    if (ok) {
      setCommentText('');
    }
    setSendingComment(false);
  };

  const handleDeleteCommentClick = async (commentId: string) => {
    if (deletingCommentId) return;
    setDeletingCommentId(commentId);
    await onDeleteComment(movie.id, commentId);
    setDeletingCommentId(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="movie-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#090D16]/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-[var(--cr-surface)] shadow-2xl dark:border dark:border-[var(--cr-border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar detalhes do filme"
          className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--cr-border)] bg-[var(--cr-surface)] text-[var(--cr-ink-secondary)] shadow-xs transition-colors hover:text-[var(--cr-ink)] cursor-pointer"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-12 md:items-stretch">
          <div className="md:col-span-5 bg-[#0F172A]">
            {!imageError && movie.posterUrl ? (
              <img
                src={movie.posterUrl}
                alt={`Pôster de ${movie.title}`}
                referrerPolicy="no-referrer"
                onError={() => setImageError(true)}
                className="aspect-[3/4] md:aspect-auto md:h-full w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[3/4] md:aspect-auto md:h-full w-full flex-col items-center justify-center p-6 text-center text-white">
                <Film className="h-12 w-12 text-slate-400" aria-hidden="true" />
                <span className="mt-3 font-editorial text-xl font-semibold">
                  {movie.title}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col justify-between p-6 sm:p-8 md:col-span-7">
            <div>
              <div className="flex flex-wrap items-center gap-2 pr-10 text-xs font-medium text-[var(--cr-ink-muted)]">
                <span className="font-semibold text-[var(--cr-accent)]">{movie.genre}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{movie.year}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{movie.durationMinutes} min</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono font-semibold text-[#059669] dark:text-emerald-400 tabular-nums">
                  {approvalPct}% aprovação
                </span>
              </div>

              <h2
                id="movie-modal-title"
                className="mt-2 font-display text-2xl font-bold tracking-tight text-[var(--cr-ink)] sm:text-3xl [text-wrap:balance]"
              >
                {movie.title}
              </h2>
              <p className="mt-1 text-sm text-[var(--cr-ink-muted)]">Direção: {movie.director}</p>

              <p className="mt-4 text-sm leading-relaxed text-[var(--cr-ink-secondary)]">
                {movie.synopsis}
              </p>

              <div className="mt-5 border-t border-[var(--cr-border)] pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-[var(--cr-ink)]">
                    Indicado por {movie.recommendedBy}
                  </p>

                  {isOwner && (
                    <div className="flex items-center gap-2">
                      {!confirmingDelete ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onEditMovie(movie)}
                            className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-[var(--cr-border)] bg-[var(--cr-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--cr-ink-secondary)] hover:border-[var(--cr-accent)] hover:text-[var(--cr-accent)] whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Editar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingDelete(true)}
                            className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-[var(--cr-border)] bg-[var(--cr-surface)] px-2.5 py-1 text-xs font-semibold text-[#DC2626] hover:border-[#FECACA] hover:bg-[#FEF2F2] dark:hover:bg-rose-950/50 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Excluir</span>
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={deletingMovie}
                            onClick={handleConfirmDelete}
                            className="inline-flex min-h-[34px] items-center rounded-lg bg-[#DC2626] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#B91C1C] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            {deletingMovie ? 'Excluindo...' : 'Confirmar exclusão'}
                          </button>
                          <button
                            type="button"
                            disabled={deletingMovie}
                            onClick={() => setConfirmingDelete(false)}
                            className="inline-flex min-h-[34px] items-center rounded-lg border border-[var(--cr-border)] px-2.5 py-1 text-xs font-medium text-[var(--cr-ink-secondary)] hover:bg-[var(--cr-surface-hover)] whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <p className="mt-1 font-editorial text-base italic leading-relaxed text-[var(--cr-ink-secondary)]">
                  “{movie.recommendationNote}”
                </p>
              </div>

              {/* Avaliação Gostei / Não gostei + Estrelas */}
              <div className="mt-5 border-t border-[var(--cr-border)] pt-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[var(--cr-ink-secondary)]">
                    Você gostou deste filme?
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onEvaluateMovie(movie.id, 'like')}
                      aria-pressed={hasLiked}
                      className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors tabular-nums whitespace-nowrap shrink-0 cursor-pointer ${
                        hasLiked
                          ? 'border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46] dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'border-[var(--cr-border)] bg-[var(--cr-surface-hover)] text-[var(--cr-ink-secondary)] hover:bg-[var(--cr-surface)]'
                      }`}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Gostei ({movie.likedBy.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onEvaluateMovie(movie.id, 'dislike')}
                      aria-pressed={hasDisliked}
                      className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors tabular-nums whitespace-nowrap shrink-0 cursor-pointer ${
                        hasDisliked
                          ? 'border-[#FECACA] bg-[#FEF2F2] text-[#991B1B] dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                          : 'border-[var(--cr-border)] bg-[var(--cr-surface-hover)] text-[var(--cr-ink-secondary)] hover:bg-[var(--cr-surface)]'
                      }`}
                    >
                      <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Não gostei ({movie.dislikedBy.length})</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <span className="text-xs font-semibold text-[var(--cr-ink-secondary)]">
                    Sua nota (1 a 5 estrelas)
                  </span>
                  <span className="font-mono text-xs text-[var(--cr-ink-muted)] tabular-nums">
                    {personalRating !== undefined
                      ? `Sua nota: ${personalRating.toFixed(1)}/5 · Média geral: ${movie.rating.toFixed(1)}/5 (${ratingsCount})`
                      : `Média: ${movie.rating.toFixed(1)}/5 (${ratingsCount} ${ratingsCount === 1 ? 'avaliação' : 'avaliações'})`}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((value) => {
                    const active = (personalRating ?? 0) >= value;
                    const isCurrentExact = personalRating === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => handleStarClick(value)}
                        title={
                          !isOwner && isCurrentExact
                            ? 'Clique novamente para remover sua nota'
                            : `Avaliar com ${value} estrelas`
                        }
                        aria-label={`Avaliar com ${value} estrelas`}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--cr-border)] bg-[var(--cr-surface)] transition-colors hover:border-[#F59E0B] cursor-pointer"
                      >
                        <Star
                          className={`h-4 w-4 ${
                            active ? 'fill-[#F59E0B] text-[#F59E0B]' : 'text-[var(--cr-border-strong)]'
                          }`}
                          aria-hidden="true"
                        />
                      </button>
                    );
                  })}
                </div>
                {personalRating !== undefined && (
                  <p className="text-[11px] text-[var(--cr-ink-muted)]">
                    {isOwner
                      ? 'Como autor da indicação, você pode ajustar sua nota de 1 a 5 estrelas a qualquer momento.'
                      : 'Dica: clique novamente na estrela selecionada se quiser remover sua nota.'}
                  </p>
                )}
              </div>

              {/* Comentários e opiniões curtas sobre o filme */}
              <div className="mt-5 border-t border-[var(--cr-border)] pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-[var(--cr-ink-secondary)]">
                    Comentários da comunidade ({comments.length})
                  </h3>
                </div>

                {authUser ? (
                  <form onSubmit={handleSubmitComment} className="flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={240}
                      disabled={sendingComment}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Escreva um comentário curto sobre o filme..."
                      aria-label="Comentário sobre o filme"
                      className="min-w-0 flex-1 rounded-lg border border-[var(--cr-border-strong)] bg-[var(--cr-surface)] px-3 py-2 text-xs text-[var(--cr-ink)] placeholder:text-[var(--cr-ink-muted)] focus:border-[var(--cr-accent)] focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={sendingComment || commentText.trim().length < 2}
                      className="inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-lg bg-[var(--cr-accent)] px-3 text-xs font-semibold text-white transition-colors hover:bg-[var(--cr-accent-hover)] disabled:opacity-45 cursor-pointer"
                    >
                      <Send className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{sendingComment ? 'Enviando...' : 'Publicar'}</span>
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenAuthModal('Entre na sua conta para deixar um comentário neste filme.')
                    }
                    className="w-full rounded-lg border border-dashed border-[var(--cr-border-strong)] bg-[var(--cr-surface-hover)] px-3 py-2.5 text-left text-xs font-medium text-[var(--cr-ink-secondary)] hover:border-[var(--cr-accent)] hover:text-[var(--cr-accent)] cursor-pointer"
                  >
                    Entre na sua conta para comentar sobre este filme.
                  </button>
                )}

                {comments.length > 0 && (
                  <ul className="max-h-44 space-y-2 overflow-y-auto pr-1">
                    {comments.map((comment) => {
                      const canDelete = Boolean(authUser && comment.userKey === authUser.userKey);
                      return (
                        <li
                          key={comment.id}
                          className="rounded-xl border border-[var(--cr-border)] bg-[var(--cr-surface-hover)] px-3 py-2.5"
                        >
                          <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--cr-ink-muted)]">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-semibold text-[var(--cr-ink)] truncate">
                                {comment.author}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums shrink-0">
                                {formatCommentDate(comment.createdAt)}
                              </span>
                            </div>
                            {canDelete && (
                              <button
                                type="button"
                                disabled={deletingCommentId === comment.id}
                                onClick={() => handleDeleteCommentClick(comment.id)}
                                aria-label="Excluir comentário"
                                title="Excluir comentário"
                                className="inline-flex h-6 w-6 items-center justify-center rounded text-[var(--cr-ink-muted)] hover:text-[#DC2626] cursor-pointer shrink-0"
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-[var(--cr-ink-secondary)] break-words">
                            {comment.text}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2.5 border-t border-[var(--cr-border)] pt-5">
              <button
                type="button"
                onClick={() => onToggleWatchlist(movie.id)}
                className={`inline-flex min-h-[42px] items-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isSaved
                    ? 'border-[var(--cr-accent-border)] bg-[var(--cr-accent-soft)] text-[var(--cr-accent-text)]'
                    : 'border-[var(--cr-border)] bg-[var(--cr-surface)] text-[var(--cr-ink)] hover:bg-[var(--cr-surface-hover)]'
                }`}
              >
                <Bookmark
                  className={`h-4 w-4 ${
                    isSaved ? 'fill-[var(--cr-accent)] text-[var(--cr-accent)]' : ''
                  }`}
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
                className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[var(--cr-accent)] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--cr-accent-hover)] whitespace-nowrap shrink-0 cursor-pointer"
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
