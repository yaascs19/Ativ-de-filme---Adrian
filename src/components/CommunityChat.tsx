import { FormEvent, useEffect, useRef, useState } from 'react';
import { Film, Paperclip, Send, UserCheck, X } from 'lucide-react';
import { ChatMessage, MovieItem } from '../types/cinema';

interface CommunityChatProps {
  messages: ChatMessage[];
  movies: MovieItem[];
  userName: string;
  onUpdateUserName: (name: string) => void;
  attachedMovieId: string | null;
  onChangeAttachedMovieId: (movieId: string | null) => void;
  onSendMessage: (text: string, attachedMovieId?: string) => Promise<boolean>;
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
  userName,
  onUpdateUserName,
  attachedMovieId,
  onChangeAttachedMovieId,
  onSendMessage,
  onSelectMovie,
  isConnected,
}: CommunityChatProps) {
  const [nameDraft, setNameDraft] = useState(userName);
  const [editingName, setEditingName] = useState(!userName);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [showMoviePicker, setShowMoviePicker] = useState(false);
  const listEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setNameDraft(userName);
    if (!userName) {
      setEditingName(true);
    }
  }, [userName]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const attachedMovie = attachedMovieId
    ? movies.find((m) => m.id === attachedMovieId) ?? null
    : null;

  const handleSaveName = (e: FormEvent) => {
    e.preventDefault();
    const cleaned = nameDraft.trim().slice(0, 40);
    if (cleaned.length < 2) return;
    onUpdateUserName(cleaned);
    setEditingName(false);
  };

  const handleSubmitMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!userName || sending) return;
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

  return (
    <aside
      aria-label="Chat de indicações da comunidade"
      className="flex h-[580px] lg:h-[680px] flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white"
    >
      {/* Cabeçalho do chat */}
      <div className="flex items-center justify-between gap-3 border-b border-[#E2E8F0] px-5 py-4">
        <div>
          <h2 className="font-display text-base font-bold text-[#111827]">
            Chat de Indicações
          </h2>
          <p className="mt-0.5 text-xs text-[#64748B] tabular-nums">
            {isConnected
              ? `Conectado · ${messages.length} mensagens`
              : 'Sincronizando mensagens...'}
          </p>
        </div>

        {!editingName && userName && (
          <button
            type="button"
            onClick={() => setEditingName(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1.5 text-xs font-medium text-[#334155] hover:bg-[#F1F5F9] cursor-pointer whitespace-nowrap shrink-0"
          >
            <UserCheck className="h-3.5 w-3.5 text-[#059669]" aria-hidden="true" />
            <span className="max-w-[96px] truncate">{userName}</span>
          </button>
        )}
      </div>

      {/* Identificação rápida do usuário para conversar */}
      {editingName && (
        <form
          onSubmit={handleSaveName}
          className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3"
        >
          <label
            htmlFor="chat-username"
            className="block text-xs font-semibold text-[#334155]"
          >
            Como você quer aparecer no chat?
          </label>
          <div className="mt-2 flex items-center gap-2">
            <input
              id="chat-username"
              type="text"
              minLength={2}
              maxLength={40}
              required
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="Seu nome ou apelido"
              className="min-w-0 flex-1 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-xs text-[#111827] focus:border-[#E11D48] focus:outline-none"
            />
            <button
              type="submit"
              className="min-h-[36px] rounded-lg bg-[#111827] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1E293B] cursor-pointer whitespace-nowrap shrink-0"
            >
              Salvar
            </button>
          </div>
        </form>
      )}

      {/* Lista de mensagens */}
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center px-4">
            <p className="text-sm font-medium text-[#475569]">
              Nenhuma mensagem ainda.
            </p>
            <p className="mt-1 text-xs text-[#64748B]">
              Puxe assunto ou anexe um filme do catálogo para iniciar a conversa.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = userName && msg.author.toLowerCase() === userName.toLowerCase();
            const linkedMovie = msg.attachedMovieId
              ? movies.find((m) => m.id === msg.attachedMovieId)
              : undefined;

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
              >
                <div className="mb-1 flex items-center gap-1.5 text-[11px] text-[#64748B]">
                  <span className="font-semibold text-[#334155]">{msg.author}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {formatTime(msg.createdAt)}
                  </span>
                </div>

                <div
                  className={`max-w-[88%] rounded-2xl border px-3.5 py-2.5 text-sm leading-relaxed ${
                    isOwn
                      ? 'border-[#FECDD3] bg-[#FFF1F2] text-[#111827]'
                      : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#111827]'
                  }`}
                >
                  <p className="break-words">{msg.text}</p>

                  {linkedMovie && (
                    <button
                      type="button"
                      onClick={() => onSelectMovie(linkedMovie)}
                      className="mt-2.5 flex w-full items-center gap-2.5 rounded-xl border border-[#E2E8F0] bg-white p-2 text-left transition-colors hover:border-[#CBD5E1] cursor-pointer"
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
                        <p className="truncate text-xs font-bold text-[#111827]">
                          {linkedMovie.title}
                        </p>
                        <p className="truncate text-[11px] text-[#64748B] tabular-nums">
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
      <div className="border-t border-[#E2E8F0] bg-[#F8FAFC] p-3.5">
        {/* Seletor de filme anexado */}
        {showMoviePicker && (
          <div className="mb-2.5 max-h-36 overflow-y-auto rounded-xl border border-[#E2E8F0] bg-white p-2">
            <div className="flex items-center justify-between px-1 pb-1.5 text-[11px] font-semibold text-[#64748B]">
              <span>Escolha um filme para indicar no chat</span>
              <button
                type="button"
                onClick={() => setShowMoviePicker(false)}
                className="text-[#475569] hover:text-[#111827] cursor-pointer"
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
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-[#F8FAFC] cursor-pointer"
                >
                  <span className="truncate font-medium text-[#111827]">{m.title}</span>
                  <span className="ml-2 shrink-0 text-[11px] text-[#64748B] tabular-nums">
                    {m.year}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {attachedMovie && (
          <div className="mb-2.5 flex items-center justify-between gap-2 rounded-xl border border-[#FECDD3] bg-white px-3 py-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <Film className="h-3.5 w-3.5 shrink-0 text-[#E11D48]" aria-hidden="true" />
              <span className="truncate font-semibold text-[#111827]">
                Indicando: {attachedMovie.title}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onChangeAttachedMovieId(null)}
              aria-label="Remover filme anexado"
              className="text-[#64748B] hover:text-[#111827] cursor-pointer shrink-0"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmitMessage} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowMoviePicker((prev) => !prev)}
            title="Anexar filme do catálogo"
            aria-label="Anexar filme do catálogo"
            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors cursor-pointer ${
              attachedMovie || showMoviePicker
                ? 'border-[#E11D48] bg-[#FFF1F2] text-[#E11D48]'
                : 'border-[#CBD5E1] bg-white text-[#475569] hover:text-[#111827]'
            }`}
          >
            <Paperclip className="h-4 w-4" aria-hidden="true" />
          </button>

          <input
            type="text"
            maxLength={400}
            disabled={!userName || sending}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder={
              userName
                ? 'Converse ou indique um filme...'
                : 'Defina seu nome acima para conversar'
            }
            className="min-w-0 flex-1 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#111827] placeholder:text-[#94A3B8] focus:border-[#E11D48] focus:outline-none disabled:bg-[#F1F5F9]"
          />

          <button
            type="submit"
            disabled={!userName || sending || (!messageText.trim() && !attachedMovieId)}
            aria-label="Enviar mensagem"
            className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#E11D48] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-[#BE123C] disabled:bg-[#CBD5E1] disabled:text-[#64748B] disabled:pointer-events-none cursor-pointer"
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Enviar</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
