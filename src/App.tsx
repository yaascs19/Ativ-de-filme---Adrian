import { useCallback, useEffect, useMemo, useState } from 'react';
import { Film, Search } from 'lucide-react';
import { CommunityChat } from './components/CommunityChat';
import { Footer } from './components/Footer';
import { Header, MobileView } from './components/Header';
import { MovieCard } from './components/MovieCard';
import { MovieDetailModal } from './components/MovieDetailModal';
import { RecommendMovieModal } from './components/RecommendMovieModal';
import { GENRES } from './data/posters';
import {
  ChatMessage,
  EvaluationChoice,
  GenreFilter,
  MovieItem,
  PersonalPreferences,
} from './types/cinema';
import {
  loadPreferencesFromStorage,
  savePreferencesToStorage,
} from './utils/watchlistStorage';

type SortOption = 'recentes' | 'votos' | 'nota';

export default function App() {
  const [prefs, setPrefs] = useState<PersonalPreferences>(() => loadPreferencesFromStorage());
  const [movies, setMovies] = useState<MovieItem[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string>('');

  const [activeView, setActiveView] = useState<MobileView>('catalogo');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('recentes');

  const [selectedMovieId, setSelectedMovieId] = useState<string | null>(null);
  const [isRecommendOpen, setIsRecommendOpen] = useState<boolean>(false);
  const [attachedMovieId, setAttachedMovieId] = useState<string | null>(null);

  const [isConnected, setIsConnected] = useState<boolean>(false);

  // Salva preferências pessoais (nome, Minha Lista, avaliações e filtro) no localStorage
  useEffect(() => {
    savePreferencesToStorage(prefs);
  }, [prefs]);

  const syncCatalogAndChat = useCallback(async (isInitial = false) => {
    try {
      const [moviesRes, chatRes] = await Promise.all([
        fetch('/api/movies'),
        fetch('/api/chat'),
      ]);
      if (!moviesRes.ok || !chatRes.ok) {
        throw new Error('Falha ao carregar os dados.');
      }
      const moviesData = (await moviesRes.json()) as { movies: MovieItem[] };
      const chatData = (await chatRes.json()) as { messages: ChatMessage[] };

      setMovies(moviesData.movies);
      setMessages(chatData.messages);
      setIsConnected(true);
      setLoadError('');
    } catch {
      setIsConnected(false);
      if (isInitial) {
        setLoadError('Não foi possível conectar à API do catálogo.');
      }
    } finally {
      if (isInitial) {
        setLoading(false);
      }
    }
  }, []);

  // Carrega inicialmente e atualiza a cada 4 segundos (compatível com Vercel Serverless)
  useEffect(() => {
    syncCatalogAndChat(true);

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        syncCatalogAndChat(false);
      }
    }, 4000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [syncCatalogAndChat]);

  // Filtro e ordenação do catálogo usando arrays e condicionais
  const visibleMovies = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const filtered = movies.filter((movie) => {
      if (activeView === 'lista' && !prefs.watchlistIds.includes(movie.id)) {
        return false;
      }
      if (prefs.activeGenre !== 'Todos' && movie.genre !== prefs.activeGenre) {
        return false;
      }
      if (normalizedQuery) {
        const matchesTitle = movie.title.toLowerCase().includes(normalizedQuery);
        const matchesDirector = movie.director.toLowerCase().includes(normalizedQuery);
        const matchesAuthor = movie.recommendedBy.toLowerCase().includes(normalizedQuery);
        return matchesTitle || matchesDirector || matchesAuthor;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'votos') {
        return (
          b.likedBy.length -
          b.dislikedBy.length -
          (a.likedBy.length - a.dislikedBy.length)
        );
      }
      if (sortBy === 'nota') {
        return b.rating - a.rating;
      }
      return b.createdAt - a.createdAt;
    });
  }, [movies, activeView, prefs.watchlistIds, prefs.activeGenre, searchQuery, sortBy]);

  const averageRating = useMemo(() => {
    if (movies.length === 0) return '0.0';
    const sum = movies.reduce((acc, item) => acc + item.rating, 0);
    return (sum / movies.length).toFixed(1);
  }, [movies]);

  const selectedMovie = useMemo(
    () => movies.find((m) => m.id === selectedMovieId) ?? null,
    [movies, selectedMovieId]
  );

  const handleToggleWatchlist = useCallback((movieId: string) => {
    setPrefs((prev) => {
      const exists = prev.watchlistIds.includes(movieId);
      return {
        ...prev,
        watchlistIds: exists
          ? prev.watchlistIds.filter((id) => id !== movieId)
          : [...prev.watchlistIds, movieId],
      };
    });
  }, []);

  const handleRateMovie = useCallback((movieId: string, rating: number) => {
    setPrefs((prev) => ({
      ...prev,
      personalRatings: {
        ...prev.personalRatings,
        [movieId]: rating,
      },
    }));
  }, []);

  const handleEvaluateMovie = async (movieId: string, choice: EvaluationChoice) => {
    try {
      const res = await fetch(`/api/movies/${encodeURIComponent(movieId)}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: prefs.clientId, choice }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { movie?: MovieItem };
      if (data.movie) {
        const updated = data.movie;
        setMovies((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      }
    } catch {
      // Falha silenciosa em caso de desconexão momentânea
    }
  };

  const handleSendChatMessage = async (
    text: string,
    movieIdToAttach?: string
  ): Promise<boolean> => {
    if (!prefs.userName) return false;
    const msgId = `msg-${prefs.clientId.slice(0, 6)}-${Date.now()}`;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: msgId,
          author: prefs.userName,
          text,
          attachedMovieId: movieIdToAttach,
        }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { message?: ChatMessage };
      if (data.message) {
        const savedMsg = data.message;
        setMessages((prev) =>
          prev.some((m) => m.id === savedMsg.id) ? prev : [...prev, savedMsg].slice(-150)
        );
      }
      return true;
    } catch {
      return false;
    }
  };

  const handleMovieCreated = async (
    newMovie: MovieItem,
    shareInChat: boolean,
    authorName: string
  ) => {
    setMovies((prev) => (prev.some((m) => m.id === newMovie.id) ? prev : [newMovie, ...prev]));
    if (!prefs.userName && authorName) {
      setPrefs((prev) => ({ ...prev, userName: authorName }));
    }

    if (shareInChat) {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          author: authorName,
          text: `Acabei de adicionar "${newMovie.title}" no catálogo! ${newMovie.recommendationNote}`,
          attachedMovieId: newMovie.id,
        }),
      });
      syncCatalogAndChat(false);
    }
  };

  const handleRecommendInChat = (movie: MovieItem) => {
    setAttachedMovieId(movie.id);
    setActiveView('chat');
  };

  const handleSelectView = useCallback((view: MobileView) => {
    setActiveView(view);
    if (view === 'chat' && typeof window !== 'undefined' && window.innerWidth >= 1024) {
      window.requestAnimationFrame(() => {
        document.getElementById('comunidade-chat')?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      });
    }
  }, []);

  const genreFilters: GenreFilter[] = ['Todos', ...GENRES];

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FB] text-[#111827]">
      <Header
        activeView={activeView}
        onSelectView={handleSelectView}
        watchlistCount={prefs.watchlistIds.length}
        chatMessagesCount={messages.length}
        onOpenRecommendModal={() => setIsRecommendOpen(true)}
      />

      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {/* Cabeçalho editorial + resumo rápido */}
        <div className="mb-6 flex flex-col gap-4 border-b border-[#E2E8F0] pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-[#111827] sm:text-3xl [text-wrap:balance]">
              {activeView === 'lista'
                ? 'Sua Lista para Assistir Depois'
                : 'Catálogo Colaborativo de Filmes'}
            </h1>
            <p className="mt-1.5 text-sm text-[#475569]">
              Explore indicações da comunidade, salve seus favoritos e converse no chat sobre o que assistir.
            </p>
          </div>

          <dl className="flex items-center gap-6 text-xs text-[#64748B] shrink-0">
            <div>
              <dt>Filmes no catálogo</dt>
              <dd className="mt-0.5 font-display text-lg font-bold text-[#111827] tabular-nums">
                {movies.length}
              </dd>
            </div>
            <div className="h-8 w-px bg-[#E2E8F0]" aria-hidden="true" />
            <div>
              <dt>Média geral</dt>
              <dd className="mt-0.5 font-display text-lg font-bold text-[#111827] tabular-nums">
                {averageRating}/5
              </dd>
            </div>
            <div className="h-8 w-px bg-[#E2E8F0]" aria-hidden="true" />
            <div>
              <dt>Na sua lista</dt>
              <dd className="mt-0.5 font-display text-lg font-bold text-[#E11D48] tabular-nums">
                {prefs.watchlistIds.length}
              </dd>
            </div>
          </dl>
        </div>

        {/* Layout principal: Catálogo (8 colunas) + Chat (4 colunas) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
          {/* Coluna do catálogo (oculta no celular quando a aba Chat estiver ativa) */}
          <div
            className={`lg:col-span-8 space-y-5 ${
              activeView === 'chat' ? 'hidden lg:block' : 'block'
            }`}
          >
            {/* Busca, ordenação e abas de gênero */}
            <div className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por título, direção ou quem indicou..."
                    aria-label="Buscar filmes"
                    className="min-h-[42px] w-full rounded-xl border border-[#E2E8F0] bg-white pl-10 pr-4 text-sm text-[#111827] placeholder:text-[#94A3B8] focus:border-[#E11D48] focus:outline-none"
                  />
                </div>

                <select
                  aria-label="Ordenar filmes"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="min-h-[42px] rounded-xl border border-[#E2E8F0] bg-white px-3.5 text-sm font-medium text-[#334155] focus:border-[#E11D48] focus:outline-none cursor-pointer"
                >
                  <option value="recentes">Mais recentes</option>
                  <option value="votos">Mais recomendados</option>
                  <option value="nota">Maior nota</option>
                </select>

                <button
                  type="button"
                  onClick={() => setIsRecommendOpen(true)}
                  className="min-h-[42px] rounded-xl border border-[#E11D48] bg-[#FFF1F2] px-4 text-sm font-semibold text-[#BE123C] transition-colors hover:bg-[#FFE4E6] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  + Indicar Filme
                </button>
              </div>

              <div
                role="tablist"
                aria-label="Filtrar por gênero"
                className="flex items-center gap-1.5 overflow-x-auto rounded-xl border border-[#E2E8F0] bg-[#F1F5F9] p-1"
              >
                {genreFilters.map((genre) => {
                  const isActive = prefs.activeGenre === genre;
                  return (
                    <button
                      key={genre}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() =>
                        setPrefs((prev) => ({ ...prev, activeGenre: genre }))
                      }
                      className={`min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        isActive
                          ? 'bg-white text-[#111827] font-semibold shadow-xs'
                          : 'text-[#475569] hover:text-[#111827]'
                      }`}
                    >
                      {genre}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Estados de carregamento / erro / vazio / grid */}
            {loading ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="h-[420px] animate-pulse rounded-2xl border border-[#E2E8F0] bg-white"
                  />
                ))}
              </div>
            ) : loadError ? (
              <div className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-6 text-sm text-[#991B1B]">
                {loadError}
              </div>
            ) : visibleMovies.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-white p-10 text-center">
                <Film className="mx-auto h-8 w-8 text-[#94A3B8]" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold text-[#111827]">
                  {activeView === 'lista'
                    ? 'Sua lista ainda está vazia.'
                    : 'Nenhum filme encontrado com esses filtros.'}
                </p>
                <p className="mt-1 text-xs text-[#64748B]">
                  {activeView === 'lista'
                    ? 'Clique em "Salvar" nos filmes do catálogo para montar sua lista pessoal.'
                    : 'Tente limpar a busca ou indique um novo filme para a comunidade.'}
                </p>
                <div className="mt-4 flex justify-center gap-3">
                  {activeView === 'lista' ? (
                    <button
                      type="button"
                      onClick={() => setActiveView('catalogo')}
                      className="min-h-[40px] rounded-lg bg-[#111827] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E293B] cursor-pointer"
                    >
                      Explorar Catálogo
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setPrefs((prev) => ({ ...prev, activeGenre: 'Todos' }));
                      }}
                      className="min-h-[40px] rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#111827] hover:bg-[#F8FAFC] cursor-pointer"
                    >
                      Limpar Filtros
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {visibleMovies.map((movie) => (
                  <MovieCard
                    key={movie.id}
                    movie={movie}
                    isSaved={prefs.watchlistIds.includes(movie.id)}
                    hasLiked={movie.likedBy.includes(prefs.clientId)}
                    hasDisliked={movie.dislikedBy.includes(prefs.clientId)}
                    personalRating={prefs.personalRatings[movie.id]}
                    onToggleWatchlist={handleToggleWatchlist}
                    onEvaluateMovie={handleEvaluateMovie}
                    onOpenDetail={(m) => setSelectedMovieId(m.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Coluna do Chat (sempre visível no desktop, aba dedicada no celular) */}
          <div
            className={`lg:col-span-4 ${
              activeView === 'chat' ? 'block' : 'hidden lg:block'
            }`}
          >
            <CommunityChat
              messages={messages}
              movies={movies}
              userName={prefs.userName}
              onUpdateUserName={(name) =>
                setPrefs((prev) => ({ ...prev, userName: name }))
              }
              attachedMovieId={attachedMovieId}
              onChangeAttachedMovieId={setAttachedMovieId}
              onSendMessage={handleSendChatMessage}
              onSelectMovie={(m) => setSelectedMovieId(m.id)}
              isConnected={isConnected}
            />
          </div>
        </div>
      </main>

      <Footer />

      <MovieDetailModal
        movie={selectedMovie}
        isSaved={selectedMovie ? prefs.watchlistIds.includes(selectedMovie.id) : false}
        hasLiked={selectedMovie ? selectedMovie.likedBy.includes(prefs.clientId) : false}
        hasDisliked={selectedMovie ? selectedMovie.dislikedBy.includes(prefs.clientId) : false}
        personalRating={
          selectedMovie ? prefs.personalRatings[selectedMovie.id] : undefined
        }
        onClose={() => setSelectedMovieId(null)}
        onToggleWatchlist={handleToggleWatchlist}
        onEvaluateMovie={handleEvaluateMovie}
        onRateMovie={handleRateMovie}
        onRecommendInChat={handleRecommendInChat}
      />

      <RecommendMovieModal
        isOpen={isRecommendOpen}
        defaultAuthorName={prefs.userName}
        clientId={prefs.clientId}
        onClose={() => setIsRecommendOpen(false)}
        onMovieCreated={handleMovieCreated}
      />
    </div>
  );
}
