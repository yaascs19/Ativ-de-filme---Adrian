import { FormEvent, useEffect, useRef, useState } from 'react';
import { Film, LogIn, MessageCircle, Paperclip, Send, Trash2, UserCheck, X } from 'lucide-react';
import { AuthUser, ChatMessage, MovieItem } from '../types/cinema';

interface CommunityChatProps {
  messages: ChatMessage[];
  movies: MovieItem[];
  authUser: AuthUser | null;
  onOpenAuthModal: () => void;
  attachedMovieId: string | null;
  onChangeAttachedMovieId: (movieId: string | null) => void;
  onSendMessage: (text: string, attachedMovieId?: string) => Promise<boolean>;
  onDeleteMessage: (messageId: string) => Promise<void>;
  onSelectMovie: (movie: MovieItem) => void;
  isConnected: boolean;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function CommunityChat({
  messages,
  movies,
  authUser,
  onOpenAuthModal,
  attachedMovieId,
  onChangeAttachedMovieId,
  onSendMessage,
  onDeleteMessage,
  onSelectMovie,
  isConnected,
}: CommunityChatProps) {
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [showMoviePicker, setShowMoviePicker] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const listEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const attachedMovie = attachedMovieId
    ? movies.find((m) => m.id === attachedMovieId) ?? null
    : null;

  const handleSubmitMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!authUser) {
      onOpenAuthModal();
      return;
    }
    if (sending) return;
    const cleaned = messageText.trim();
    if (!cleaned && !attachedMovieId) return;

    const finalText =
      cleaned ||
      (attachedMovie ? `Recomendo assistir "${attachedMovie.title}"!` : '');

    setSending(true);
    const ok = await onSendMessage(finalText, attachedMovieId ?? undefined);
    if (ok) {
      setMessageText('');
      onChangeAttachedMovieId(null);
      setShowMoviePicker(false);
    }
    setSending(false);
  };

  const handleDeleteClick = async (messageId: string) => {
    if (deletingId) return;
    setDeletingId(messageId);
    await onDeleteMessage(messageId);
    setDeletingId(null);
  };

  return (
    <aside
      id="comunidade-chat"
      aria-label="Chat de indicações da comunidade"
      className="flex h-[580px] lg:sticky lg:top-20 lg:h-[680px] flex-col overflow-hidden rounded-2xl bg-[var(--cr-surface)] shadow-[0_1px_3px_rgba(15,23,42,0.06),0_12px_28px_-14px_rgba(15,23,42,0.14)] dark:border dark:border-[var(--cr-border)]"
    >
      {/* Cabeçalho do chat */}
      <div className="flex items-center justify-between gap-3 border-b border-[var(--cr-border)] bg-[var(--cr-surface-hover)] px-5 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--cr-accent-soft)] text-[var(--cr-accent)]">
            <MessageCircle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-base font-bold text-[var(--cr-ink)] truncate">
              Chat da Comunidade
            </h2>
            <p className="mt-0.5 text-xs text-[var(--cr-ink-muted)] tabular-nums truncate">
              {isConnected
                ? `Conectado · ${messages.length} mensagens`
                : 'Sincronizando mensagens...'}
            </p>
          </div>
        </div>

        {authUser && (
          <button
            type="button"
            onClick={onOpenAuthModal}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--cr-border)] bg-[var(--cr-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--cr-ink-secondary)] hover:bg-[var(--cr-surface-alt)] cursor-pointer whitespace-nowrap shrink-0"
          >
            <UserCheck className="h-3.5 w-3.5 text-[#059669]" aria-hidden="true" />
            <span className="max-w-[96px] truncate">{authUser.name}</span>
          </button>
        )}
      </div>

      {/* Aviso para entrar na conta quando visitante */}
      {!authUser && (
        <div className="flex items-center justify-between gap-3 border-b border-[var(--cr-border)] bg-[var(--cr-surface-alt)] px-4 py-3">
          <p className="text-xs text-[var(--cr-ink-secondary)]">
            Entre na sua conta para participar do chat e indicar filmes.
          </p>
          <button
            type="button"
            onClick={onOpenAuthModal}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-[var(--cr-accent)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--cr-accent-hover)] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Entrar</span>
          </button>
        </div>
      )}

      {/* Lista de mensagens */}
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center px-4">
            <p className="text-sm font-medium text-[var(--cr-ink-secondary)]">
              Nenhuma mensagem ainda.
            </p>
            <p className="mt-1 text-xs text-[var(--cr-ink-muted)]">
              Puxe assunto ou anexe um filme do catálogo para iniciar a conversa.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn =
              authUser !== null &&
              (msg.userKey
                ? msg.userKey === authUser.userKey
                : msg.author.toLowerCase() === authUser.name.toLowerCase());
            const canDelete = Boolean(authUser && msg.userKey && msg.userKey === authUser.userKey);
            const linkedMovie = msg.attachedMovieId
              ? movies.find((m) => m.id === msg.attachedMovieId)
              : undefined;

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
              >
                <div className="mb-1 flex items-center gap-1.5 text-[11px] text-[var(--cr-ink-muted)]">
                  <span className="font-semibold text-[var(--cr-ink-secondary)]">
                    {msg.author}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {formatTime(msg.createdAt)}
                  </span>
                  {canDelete && (
                    <button
                      type="button"
                      disabled={deletingId === msg.id}
                      onClick={() => handleDeleteClick(msg.id)}
                      title="Apagar mensagem"
                      aria-label="Apagar mensagem"
                      className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded text-[var(--cr-ink-muted)] hover:text-[#DC2626] disabled:opacity-40 cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                    </button>
                  )}
                </div>

                <div
                  className={`max-w-[88%] rounded-2xl border px-3.5 py-2.5 text-sm leading-relaxed text-[var(--cr-ink)] ${
                    isOwn
                      ? 'border-[var(--cr-accent-border)] bg-[var(--cr-accent-soft)]'
                      : 'border-[var(--cr-border)] bg-[var(--cr-surface-hover)]'
                  }`}
                >
                  <p className="break-words">{msg.text}</p>

                  {linkedMovie && (
                    <button
                      type="button"
                      onClick={() => onSelectMovie(linkedMovie)}
                      className="mt-2.5 flex w-full items-center gap-2.5 rounded-xl border border-[var(--cr-border)] bg-[var(--cr-surface)] p-2 text-left transition-colors hover:border-[var(--cr-border-strong)] cursor-pointer"
                    >
                      {linkedMovie.posterUrl ? (
                        <img
                          src={linkedMovie.posterUrl}
                          alt={linkedMovie.title}
                          referrerPolicy="no-referrer"
                          className="h-12 w-9 shrink-0 rounded-md object-cover bg-[#0F172A]"
                        />
                      ) : (
                        <div className="flex h-12 w-9 shrink-0 items-center justify-center rounded-md bg-[#0F172A] text-white">
                          <Film className="h-4 w-4" aria-hidden="true" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-[var(--cr-ink)]">
                          {linkedMovie.title}
                        </p>
                        <p className="truncate text-[11px] text-[var(--cr-ink-muted)] tabular-nums">
                          {linkedMovie.genre} · {linkedMovie.year}
                        </p>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={listEndRef} />
      </div>

      {/* Área de envio */}
      <div className="border-t border-[var(--cr-border)] bg-[var(--cr-surface-hover)] p-3.5">
        {showMoviePicker && (
          <div className="mb-2.5 max-h-36 overflow-y-auto rounded-xl border border-[var(--cr-border)] bg-[var(--cr-surface)] p-2">
            <div className="flex items-center justify-between px-1 pb-1.5 text-[11px] font-semibold text-[var(--cr-ink-muted)]">
              <span>Escolha um filme para indicar no chat</span>
              <button
                type="button"
                onClick={() => setShowMoviePicker(false)}
                className="text-[var(--cr-ink-secondary)] hover:text-[var(--cr-ink)] cursor-pointer"
              >
                Fechar
              </button>
            </div>
            <div className="space-y-1">
              {movies.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    onChangeAttachedMovieId(m.id);
                    setShowMoviePicker(false);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-[var(--cr-surface-hover)] cursor-pointer"
                >
                  <span className="truncate font-medium text-[var(--cr-ink)]">{m.title}</span>
                  <span className="ml-2 shrink-0 text-[11px] text-[var(--cr-ink-muted)] tabular-nums">
                    {m.year}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {attachedMovie && (
          <div className="mb-2.5 flex items-center justify-between gap-2 rounded-xl border border-[var(--cr-accent-border)] bg-[var(--cr-surface)] px-3 py-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <Film className="h-3.5 w-3.5 shrink-0 text-[var(--cr-accent)]" aria-hidden="true" />
              <span className="truncate font-semibold text-[var(--cr-ink)]">
                Indicando: {attachedMovie.title}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onChangeAttachedMovieId(null)}
              aria-label="Remover filme anexado"
              className="text-[var(--cr-ink-muted)] hover:text-[var(--cr-ink)] cursor-pointer shrink-0"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmitMessage} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (!authUser) {
                onOpenAuthModal();
                return;
              }
              setShowMoviePicker((prev) => !prev);
            }}
            title="Anexar filme do catálogo"
            aria-label="Anexar filme do catálogo"
            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors cursor-pointer ${
              attachedMovie || showMoviePicker
                ? 'border-[var(--cr-accent)] bg-[var(--cr-accent-soft)] text-[var(--cr-accent)]'
                : 'border-[var(--cr-border-strong)] bg-[var(--cr-surface)] text-[var(--cr-ink-secondary)] hover:text-[var(--cr-ink)]'
            }`}
          >
            <Paperclip className="h-4 w-4" aria-hidden="true" />
          </button>

          <input
            type="text"
            maxLength={400}
            disabled={!authUser || sending}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder={
              authUser
                ? 'Converse ou indique um filme...'
                : 'Entre na sua conta para conversar'
            }
            className="min-w-0 flex-1 rounded-lg border border-[var(--cr-border-strong)] bg-[var(--cr-surface)] px-3 py-2 text-sm text-[var(--cr-ink)] placeholder:text-[var(--cr-ink-muted)] focus:border-[var(--cr-accent)] focus:outline-none disabled:bg-[var(--cr-surface-alt)]"
          />

          <button
            type="submit"
            disabled={!authUser || sending || (!messageText.trim() && !attachedMovieId)}
            aria-label="Enviar mensagem"
            className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[var(--cr-accent)] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--cr-accent-hover)] disabled:opacity-45 disabled:pointer-events-none cursor-pointer"
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Enviar</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
