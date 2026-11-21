import { FormEvent, Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  Bookmark,
  CornerUpLeft,
  Film,
  Heart,
  LogIn,
  MessageCircle,
  Paperclip,
  Search,
  Send,
  ThumbsUp,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { AuthUser, ChatMessage, ChatReactionKey, MovieItem } from '../types/cinema';

interface CommunityChatProps {
  messages: ChatMessage[];
  movies: MovieItem[];
  authUser: AuthUser | null;
  onOpenAuthModal: () => void;
  attachedMovieId: string | null;
  onChangeAttachedMovieId: (movieId: string | null) => void;
  onSendMessage: (
    text: string,
    attachedMovieId?: string,
    replyToId?: string
  ) => Promise<boolean>;
  onToggleReaction: (messageId: string, reaction: ChatReactionKey) => Promise<void>;
  onDeleteMessage: (messageId: string) => Promise<void>;
  onSelectMovie: (movie: MovieItem) => void;
  isConnected: boolean;
}

type ChatFilterMode = 'todas' | 'indicacoes';

const REACTION_OPTIONS: Array<{
  key: ChatReactionKey;
  label: string;
  Icon: typeof ThumbsUp;
}> = [
  { key: 'concordo', label: 'Concordo', Icon: ThumbsUp },
  { key: 'querover', label: 'Quero ver', Icon: Bookmark },
  { key: 'amei', label: 'Amei', Icon: Heart },
];

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDayKey(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function formatDayLabel(timestamp: number): string {
  const now = new Date();
  const target = new Date(timestamp);
  const todayKey = getDayKey(now.getTime());
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayKey = getDayKey(yesterday.getTime());
  const targetKey = getDayKey(timestamp);

  if (targetKey === todayKey) return 'Hoje';
  if (targetKey === yesterdayKey) return 'Ontem';

  return target.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    ...(target.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
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
  onToggleReaction,
  onDeleteMessage,
  onSelectMovie,
  isConnected,
}: CommunityChatProps) {
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [showMoviePicker, setShowMoviePicker] = useState(false);
  const [moviePickerQuery, setMoviePickerQuery] = useState('');
  const [filterMode, setFilterMode] = useState<ChatFilterMode>('todas');
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [unreadBelowCount, setUnreadBelowCount] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reactingKey, setReactingKey] = useState<string | null>(null);

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const prevCountRef = useRef<number>(0);

  const recommendationMessagesCount = useMemo(
    () => messages.filter((m) => Boolean(m.attachedMovieId)).length,
    [messages]
  );

  const displayedMessages = useMemo(() => {
    if (filterMode === 'indicacoes') {
      return messages.filter((m) => Boolean(m.attachedMovieId));
    }
    return messages;
  }, [messages, filterMode]);

  const filteredPickerMovies = useMemo(() => {
    const q = moviePickerQuery.trim().toLowerCase();
    if (!q) return movies;
    return movies.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.genre.toLowerCase().includes(q) ||
        String(m.year).includes(q)
    );
  }, [movies, moviePickerQuery]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const prevCount = prevCountRef.current;
    prevCountRef.current = messages.length;

    if (messages.length === 0) return;

    const isInitialLoad = prevCount === 0;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const lastMsg = messages[messages.length - 1];
    const isOwnLatest =
      authUser !== null &&
      lastMsg &&
      (lastMsg.userKey
        ? lastMsg.userKey === authUser.userKey
        : lastMsg.author.toLowerCase() === authUser.name.toLowerCase());

    if (isInitialLoad) {
      container.scrollTop = container.scrollHeight;
      setUnreadBelowCount(0);
    } else if (messages.length > prevCount) {
      const addedCount = messages.length - prevCount;
      if (isOwnLatest || distanceFromBottom < 140) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        setUnreadBelowCount(0);
      } else {
        setUnreadBelowCount((prev) => prev + addedCount);
      }
    }
  }, [messages, authUser]);

  const handleContainerScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom < 48 && unreadBelowCount > 0) {
      setUnreadBelowCount(0);
    }
  };

  const scrollToChatBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    setUnreadBelowCount(0);
  };

  const attachedMovie = attachedMovieId
    ? movies.find((m) => m.id === attachedMovieId) ?? null
    : null;

  const handleStartReply = (msg: ChatMessage) => {
    if (!authUser) {
      onOpenAuthModal();
      return;
    }
    setReplyingTo(msg);
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

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
    const ok = await onSendMessage(
      finalText,
      attachedMovieId ?? undefined,
      replyingTo?.id
    );
    if (ok) {
      setMessageText('');
      onChangeAttachedMovieId(null);
      setReplyingTo(null);
      setShowMoviePicker(false);
      setMoviePickerQuery('');
      if (filterMode === 'indicacoes' && !attachedMovieId) {
        setFilterMode('todas');
      }
    }
    setSending(false);
  };

  const handleReactionClick = async (messageId: string, reaction: ChatReactionKey) => {
    if (!authUser) {
      onOpenAuthModal();
      return;
    }
    const lockKey = `${messageId}:${reaction}`;
    if (reactingKey === lockKey) return;
    setReactingKey(lockKey);
    await onToggleReaction(messageId, reaction);
    setReactingKey(null);
  };

  const handleDeleteClick = async (messageId: string) => {
    if (deletingId) return;
    setDeletingId(messageId);
    await onDeleteMessage(messageId);
    if (replyingTo?.id === messageId) {
      setReplyingTo(null);
    }
    setDeletingId(null);
  };

  return (
    <aside
      id="comunidade-chat"
      aria-label="Chat de indicações da comunidade"
      className="flex h-[620px] lg:sticky lg:top-20 lg:h-[700px] flex-col overflow-hidden rounded-2xl bg-[var(--cr-surface)] shadow-[0_1px_3px_rgba(15,23,42,0.06),0_12px_28px_-14px_rgba(15,23,42,0.14)] dark:border dark:border-[var(--cr-border)]"
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

      {/* Sub-barra de filtro rápido: Todas vs Só indicações */}
      <div className="flex items-center justify-between gap-2 border-b border-[var(--cr-border)] bg-[var(--cr-surface)] px-4 py-2">
        <div
          role="tablist"
          aria-label="Filtrar mensagens do chat"
          className="grid w-full grid-cols-2 gap-1 rounded-lg bg-[var(--cr-surface-alt)] p-0.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={filterMode === 'todas'}
            onClick={() => setFilterMode('todas')}
            className={`min-h-[30px] rounded-md px-2.5 py-1 text-xs font-medium transition-all tabular-nums whitespace-nowrap cursor-pointer ${
              filterMode === 'todas'
                ? 'bg-[var(--cr-surface)] text-[var(--cr-ink)] font-semibold shadow-2xs'
                : 'text-[var(--cr-ink-secondary)] hover:text-[var(--cr-ink)]'
            }`}
          >
            Todas ({messages.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filterMode === 'indicacoes'}
            onClick={() => setFilterMode('indicacoes')}
            className={`inline-flex min-h-[30px] items-center justify-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all tabular-nums whitespace-nowrap cursor-pointer ${
              filterMode === 'indicacoes'
                ? 'bg-[var(--cr-surface)] text-[var(--cr-ink)] font-semibold shadow-2xs'
                : 'text-[var(--cr-ink-secondary)] hover:text-[var(--cr-ink)]'
            }`}
          >
            <Film className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span>Só indicações ({recommendationMessagesCount})</span>
          </button>
        </div>
      </div>

      {/* Aviso para entrar na conta quando visitante */}
      {!authUser && (
        <div className="flex items-center justify-between gap-3 border-b border-[var(--cr-border)] bg-[var(--cr-surface-alt)] px-4 py-3">
          <p className="text-xs text-[var(--cr-ink-secondary)]">
            Entre na sua conta para participar do chat, responder e reagir.
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

      {/* Lista de mensagens + botão flutuante de novas mensagens */}
      <div className="relative flex-1 overflow-hidden">
        <div
          ref={messagesContainerRef}
          onScroll={handleContainerScroll}
          className="h-full space-y-4 overflow-y-auto px-4 py-4"
        >
          {displayedMessages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center px-4">
              <p className="text-sm font-medium text-[var(--cr-ink-secondary)]">
                {filterMode === 'indicacoes'
                  ? 'Nenhuma indicação anexada no chat ainda.'
                  : 'Nenhuma mensagem ainda.'}
              </p>
              <p className="mt-1 text-xs text-[var(--cr-ink-muted)]">
                {filterMode === 'indicacoes'
                  ? 'Use o ícone de clipe abaixo para anexar e indicar um filme.'
                  : 'Puxe assunto ou anexe um filme do catálogo para iniciar a conversa.'}
              </p>
            </div>
          ) : (
            displayedMessages.map((msg, idx) => {
              const currentDayKey = getDayKey(msg.createdAt);
              const prevDayKey =
                idx > 0 ? getDayKey(displayedMessages[idx - 1].createdAt) : null;
              const showDateDivider = currentDayKey !== prevDayKey;

              const isOwn =
                authUser !== null &&
                (msg.userKey
                  ? msg.userKey === authUser.userKey
                  : msg.author.toLowerCase() === authUser.name.toLowerCase());
              const canDelete = Boolean(
                authUser && msg.userKey && msg.userKey === authUser.userKey
              );
              const linkedMovie = msg.attachedMovieId
                ? movies.find((m) => m.id === msg.attachedMovieId)
                : undefined;

              return (
                <Fragment key={msg.id}>
                  {showDateDivider && (
                    <div
                      role="separator"
                      aria-label={formatDayLabel(msg.createdAt)}
                      className="flex items-center gap-3 py-1"
                    >
                      <div className="h-px flex-1 bg-[var(--cr-border)]" />
                      <span className="text-[11px] font-medium text-[var(--cr-ink-muted)] whitespace-nowrap">
                        {formatDayLabel(msg.createdAt)}
                      </span>
                      <div className="h-px flex-1 bg-[var(--cr-border)]" />
                    </div>
                  )}

                  <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                    <div className="mb-1 flex items-center gap-1.5 text-[11px] text-[var(--cr-ink-muted)]">
                      <span className="font-semibold text-[var(--cr-ink-secondary)]">
                        {msg.author}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {formatTime(msg.createdAt)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleStartReply(msg)}
                        title="Responder mensagem"
                        aria-label={`Responder mensagem de ${msg.author}`}
                        className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded text-[var(--cr-ink-muted)] hover:text-[var(--cr-accent)] cursor-pointer"
                      >
                        <CornerUpLeft className="h-3 w-3" aria-hidden="true" />
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          disabled={deletingId === msg.id}
                          onClick={() => handleDeleteClick(msg.id)}
                          title="Apagar mensagem"
                          aria-label="Apagar mensagem"
                          className="inline-flex h-5 w-5 items-center justify-center rounded text-[var(--cr-ink-muted)] hover:text-[#DC2626] disabled:opacity-40 cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" aria-hidden="true" />
                        </button>
                      )}
                    </div>

                    <div
                      className={`max-w-[90%] rounded-2xl border px-3.5 py-2.5 text-sm leading-relaxed text-[var(--cr-ink)] ${
                        isOwn
                          ? 'border-[var(--cr-accent-border)] bg-[var(--cr-accent-soft)]'
                          : 'border-[var(--cr-border)] bg-[var(--cr-surface-hover)]'
                      }`}
                    >
                      {msg.replyTo && (
                        <div className="mb-2 rounded-lg border border-[var(--cr-border)] bg-[var(--cr-surface)] px-2.5 py-1.5 text-xs">
                          <p className="font-semibold text-[var(--cr-accent-text)] truncate">
                            Respondendo a {msg.replyTo.author}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-[var(--cr-ink-muted)]">
                            {msg.replyTo.text}
                          </p>
                        </div>
                      )}

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

                      {/* Reações rápidas por mensagem */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pt-1">
                        {REACTION_OPTIONS.map(({ key, label, Icon }) => {
                          const users = msg.reactions?.[key] ?? [];
                          const hasReacted = Boolean(
                            authUser && users.includes(authUser.userKey)
                          );
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => handleReactionClick(msg.id, key)}
                              aria-pressed={hasReacted}
                              title={label}
                              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-medium transition-colors tabular-nums cursor-pointer ${
                                hasReacted
                                  ? 'border-[var(--cr-accent-border)] bg-[var(--cr-surface)] text-[var(--cr-accent-text)] font-semibold'
                                  : 'border-[var(--cr-border)] bg-[var(--cr-surface)]/70 text-[var(--cr-ink-muted)] hover:border-[var(--cr-border-strong)] hover:text-[var(--cr-ink)]'
                              }`}
                            >
                              <Icon
                                className={`h-3 w-3 shrink-0 ${
                                  hasReacted && key === 'amei'
                                    ? 'fill-current'
                                    : hasReacted && key === 'querover'
                                      ? 'fill-current'
                                      : ''
                                }`}
                                aria-hidden="true"
                              />
                              <span>{label}</span>
                              {users.length > 0 && (
                                <span className="font-mono text-[10px]">{users.length}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </Fragment>
              );
            })
          )}
        </div>

        {unreadBelowCount > 0 && (
          <button
            type="button"
            onClick={scrollToChatBottom}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 inline-flex min-h-[34px] items-center gap-1.5 rounded-xl bg-[var(--cr-accent)] px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg transition-transform hover:bg-[var(--cr-accent-hover)] whitespace-nowrap cursor-pointer"
          >
            <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {unreadBelowCount === 1
                ? '1 nova mensagem'
                : `${unreadBelowCount} novas mensagens`}
            </span>
          </button>
        )}
      </div>

      {/* Área de envio */}
      <div className="border-t border-[var(--cr-border)] bg-[var(--cr-surface-hover)] p-3.5">
        {showMoviePicker && (
          <div className="mb-2.5 rounded-xl border border-[var(--cr-border)] bg-[var(--cr-surface)] p-2">
            <div className="flex items-center justify-between px-1 pb-1.5 text-[11px] font-semibold text-[var(--cr-ink-muted)]">
              <span>Escolha um filme para indicar no chat</span>
              <button
                type="button"
                onClick={() => {
                  setShowMoviePicker(false);
                  setMoviePickerQuery('');
                }}
                className="text-[var(--cr-ink-secondary)] hover:text-[var(--cr-ink)] cursor-pointer"
              >
                Fechar
              </button>
            </div>

            <div className="relative mb-2">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--cr-ink-muted)]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={moviePickerQuery}
                onChange={(e) => setMoviePickerQuery(e.target.value)}
                placeholder="Buscar por título, gênero ou ano..."
                aria-label="Buscar filme para anexar no chat"
                className="w-full rounded-lg border border-[var(--cr-border)] bg-[var(--cr-surface-hover)] py-1.5 pl-8 pr-2.5 text-xs text-[var(--cr-ink)] placeholder:text-[var(--cr-ink-muted)] focus:border-[var(--cr-accent)] focus:outline-none"
              />
            </div>

            <div className="max-h-32 space-y-1 overflow-y-auto">
              {filteredPickerMovies.length === 0 ? (
                <p className="px-2 py-2 text-center text-[11px] text-[var(--cr-ink-muted)]">
                  Nenhum filme encontrado para "{moviePickerQuery}".
                </p>
              ) : (
                filteredPickerMovies.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      onChangeAttachedMovieId(m.id);
                      setShowMoviePicker(false);
                      setMoviePickerQuery('');
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-[var(--cr-surface-hover)] cursor-pointer"
                  >
                    <span className="truncate font-medium text-[var(--cr-ink)]">{m.title}</span>
                    <span className="ml-2 shrink-0 text-[11px] text-[var(--cr-ink-muted)] tabular-nums">
                      {m.genre} · {m.year}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {replyingTo && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-[var(--cr-border-strong)] bg-[var(--cr-surface)] px-3 py-2 text-xs">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 font-semibold text-[var(--cr-accent-text)] truncate">
                <CornerUpLeft className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Respondendo a {replyingTo.author}</span>
              </p>
              <p className="mt-0.5 truncate text-[11px] text-[var(--cr-ink-muted)]">
                {replyingTo.text}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              aria-label="Cancelar resposta"
              className="text-[var(--cr-ink-muted)] hover:text-[var(--cr-ink)] cursor-pointer shrink-0"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
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
            ref={inputRef}
            type="text"
            maxLength={400}
            disabled={!authUser || sending}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder={
              authUser
                ? replyingTo
                  ? `Responder a ${replyingTo.author}...`
                  : 'Converse ou indique um filme...'
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
