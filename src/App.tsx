import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bookmark, Film, LogIn, Palette, Search, Sparkles, Star, UserCheck } from 'lucide-react';
import { AuthModal } from './components/AuthModal';
import { CommunityChat } from './components/CommunityChat';
import { Footer } from './components/Footer';
import { Header, MobileView } from './components/Header';
import { MovieCard } from './components/MovieCard';
import { MovieDetailModal } from './components/MovieDetailModal';
import { MoviePickerModal } from './components/MoviePickerModal';
import { RecommendMovieModal } from './components/RecommendMovieModal';
import { THEME_PALETTES } from './data/palettes';
import { GENRES } from './data/posters';
import {
  AuthUser,
  ChatMessage,
  ChatReactionKey,
  EvaluationChoice,
  GenreFilter,
  MovieItem,
  PersonalPreferences,
  ThemePaletteId,
  UserActivity,
} from './types/cinema';
import {
  loadPreferencesFromStorage,
  savePreferencesToStorage,
} from './utils/watchlistStorage';

type SortOption = 'recentes' | 'votos' | 'nota';

const MOVIES_PAGE_SIZE = 6;

export default function App() {
  const [prefs, setPrefs] = useState<PersonalPreferences>(() => loadPreferencesFromStorage());
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState<boolean>(false);

  const [movies, setMovies] = useState<MovieItem[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string>('');

  const [activeView, setActiveView] = useState<MobileView>('catalogo');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('recentes');
  const [displayLimit, setDisplayLimit] = useState<number>(MOVIES_PAGE_SIZE);

  const [selectedMovieId, setSelectedMovieId] = useState<string | null>(null);
  const [isRecommendOpen, setIsRecommendOpen] = useState<boolean>(false);
  const [isPickerOpen, setIsPickerOpen] = useState<boolean>(false);
  const [editingMovie, setEditingMovie] = useState<MovieItem | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authPromptReason, setAuthPromptReason] = useState<string>('');
  const [attachedMovieId, setAttachedMovieId] = useState<string | null>(null);

  const [isConnected, setIsConnected] = useState<boolean>(false);

  const authHeaders = useMemo<Record<string, string>>(() => {
    const headers: Record<string, string> = {};
    if (sessionToken) {
      headers.Authorization = `Bearer ${sessionToken}`;
    }
    return headers;
  }, [sessionToken]);

  // Salva preferências locais leves de visualização (gênero e paleta de prévia)
  useEffect(() => {
    savePreferencesToStorage(prefs);
  }, [prefs]);

  // Aplica a paleta escolhida na raiz do documento
  useEffect(() => {
    document.documentElement.dataset.palette = prefs.palette;
    document.documentElement.classList.toggle('dark', prefs.palette === 'noturno');
  }, [prefs.palette]);

  // Restaura sessão autenticada via cookie HttpOnly no carregamento
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!res.ok) return;
        const data = (await res.json()) as {
          user: AuthUser | null;
          activity: UserActivity | null;
        };
        if (!active) return;
        if (data.user && data.activity) {
          setAuthUser(data.user);
          setPrefs((prev) => ({
            ...prev,
            userName: data.user!.name,
            watchlistIds: data.activity!.watchlistIds,
            personalRatings: data.activity!.personalRatings,
            palette: data.activity!.palette,
          }));
        } else {
          setAuthUser(null);
          setPrefs((prev) => ({
            ...prev,
            userName: '',
            watchlistIds: [],
            personalRatings: {},
          }));
        }
      } catch {
        // Ignora erro momentâneo na restauração de sessão
      } finally {
        if (active) setAuthChecked(true);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const openLoginPrompt = useCallback((reason = '') => {
    setAuthPromptReason(reason);
    setIsAuthModalOpen(true);
  }, []);

  const handleAuthSuccess = useCallback(
    (user: AuthUser, activity: UserActivity, token?: string) => {
      setAuthUser(user);
      if (token) {
        setSessionToken(token);
      }
      setAuthPromptReason('');
      setPrefs((prev) => ({
        ...prev,
        userName: user.name,
        watchlistIds: activity.watchlistIds,
        personalRatings: activity.personalRatings,
        palette: activity.palette,
      }));
    },
    []
  );

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-Requested-With': 'CineRoda',
          ...authHeaders,
        },
      });
    } catch {
      // Limpa estado local mesmo em falha momentânea
    }
    setAuthUser(null);
    setSessionToken(null);
    setIsRecommendOpen(false);
    setEditingMovie(null);
    setPrefs((prev) => ({
      ...prev,
      userName: '',
      watchlistIds: [],
      personalRatings: {},
    }));
  }, [authHeaders]);

  const syncCatalogAndChat = useCallback(async (isInitial = false) => {
    try {
      const [moviesRes, chatRes] = await Promise.all([
        fetch('/api/movies'),
        fetch('/api/chat'),
      ]);
      if (!moviesRes.ok || !chatRes.ok) {
        const failedRes = !moviesRes.ok ? moviesRes : chatRes;
        let detailText = `HTTP ${failedRes.status}`;
        try {
          const errBody = (await failedRes.json()) as {
            error?: string;
            details?: { code?: string; message?: string };
          };
          if (errBody.details?.message) {
            detailText = `${errBody.details.code ? `[${errBody.details.code}] ` : ''}${errBody.details.message}`;
          } else if (errBody.error) {
            detailText = errBody.error;
          }
        } catch {
          // Resposta sem JSON válido
        }
        throw new Error(detailText);
      }
      const moviesData = (await moviesRes.json()) as { movies: MovieItem[] };
      const chatData = (await chatRes.json()) as { messages: ChatMessage[] };

      setMovies(moviesData.movies);
      setMessages(chatData.messages);
      setIsConnected(true);
      setLoadError('');
    } catch (err) {
      setIsConnected(false);
      if (isInitial) {
        const reason = err instanceof Error && err.message ? ` (${err.message})` : '';
        setLoadError(`Não foi possível conectar à API do catálogo.${reason}`);
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

  const handleProfileUpdated = useCallback(
    (updatedUser: AuthUser) => {
      setAuthUser(updatedUser);
      setPrefs((prev) => ({ ...prev, userName: updatedUser.name }));
      syncCatalogAndChat(false);
    },
    [syncCatalogAndChat]
  );

  const activeWatchlistIds = authUser ? prefs.watchlistIds : [];
  const activePersonalRatings = authUser ? prefs.personalRatings : {};
  const activeUserKey = authUser?.userKey ?? '';

  const authoredMoviesCount = useMemo(() => {
    if (!activeUserKey) return 0;
    return movies.filter((m) => m.ownerUserKey === activeUserKey).length;
  }, [movies, activeUserKey]);

  // Filtro e ordenação do catálogo
  const visibleMovies = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const filtered = movies.filter((movie) => {
      if (activeView === 'lista' && !activeWatchlistIds.includes(movie.id)) {
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
  }, [
    movies,
    activeView,
    activeWatchlistIds,
    prefs.activeGenre,
    searchQuery,
    sortBy,
  ]);

  useEffect(() => {
    setDisplayLimit(MOVIES_PAGE_SIZE);
  }, [activeView, prefs.activeGenre, searchQuery, sortBy]);

  const paginatedMovies = useMemo(
    () => visibleMovies.slice(0, displayLimit),
    [visibleMovies, displayLimit]
  );

  const remainingMoviesCount = Math.max(0, visibleMovies.length - paginatedMovies.length);

  const averageRating = useMemo(() => {
    if (movies.length === 0) return '0.0';
    const sum = movies.reduce((acc, item) => acc + item.rating, 0);
    return (sum / movies.length).toFixed(1);
  }, [movies]);

  const featuredMovie = useMemo(() => {
    if (movies.length === 0) return null;
    return [...movies].sort((a, b) => {
      const scoreDiff =
        b.likedBy.length - b.dislikedBy.length - (a.likedBy.length - a.dislikedBy.length);
      if (scoreDiff !== 0) return scoreDiff;
      return b.rating - a.rating;
    })[0];
  }, [movies]);

  const selectedMovie = useMemo(
    () => movies.find((m) => m.id === selectedMovieId) ?? null,
    [movies, selectedMovieId]
  );

  const handleToggleWatchlist = useCallback(
    async (movieId: string) => {
      if (!authUser) {
        openLoginPrompt('Entre ou crie uma conta para salvar filmes na sua lista pessoal.');
        return;
      }

      setPrefs((prev) => {
        const exists = prev.watchlistIds.includes(movieId);
        return {
          ...prev,
          watchlistIds: exists
            ? prev.watchlistIds.filter((id) => id !== movieId)
            : [movieId, ...prev.watchlistIds],
        };
      });

      try {
        const res = await fetch('/api/user/activity', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'CineRoda',
            ...authHeaders,
          },
          body: JSON.stringify({ action: 'toggleWatchlist', movieId }),
        });
        if (res.status === 401) {
          openLoginPrompt('Sua sessão expirou. Entre novamente para salvar sua lista.');
          return;
        }
        if (res.ok) {
          const data = (await res.json()) as { watchlistIds?: string[] };
          if (Array.isArray(data.watchlistIds)) {
            setPrefs((prev) => ({ ...prev, watchlistIds: data.watchlistIds! }));
          }
        }
      } catch {
        // Falha silenciosa em desconexão momentânea
      }
    },
    [authUser, authHeaders, openLoginPrompt]
  );

  const handleRateMovie = useCallback(
    async (movieId: string, rating: number | null) => {
      if (!authUser) {
        openLoginPrompt('Entre ou crie uma conta para salvar suas notas nos filmes.');
        return;
      }

      const previousRatings = prefs.personalRatings;
      setPrefs((prev) => {
        const next = { ...prev.personalRatings };
        if (rating === null) {
          delete next[movieId];
        } else {
          next[movieId] = rating;
        }
        return { ...prev, personalRatings: next };
      });

      try {
        const res = await fetch('/api/user/activity', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'CineRoda',
            ...authHeaders,
          },
          body: JSON.stringify({ action: 'rateMovie', movieId, rating }),
        });
        if (res.status === 401) {
          setPrefs((prev) => ({ ...prev, personalRatings: previousRatings }));
          openLoginPrompt('Sua sessão expirou. Entre novamente para salvar sua nota.');
          return;
        }
        if (!res.ok) {
          setPrefs((prev) => ({ ...prev, personalRatings: previousRatings }));
          return;
        }
        const data = (await res.json()) as {
          personalRatings?: Record<string, number>;
          movie?: MovieItem;
        };
        if (data.personalRatings) {
          setPrefs((prev) => ({ ...prev, personalRatings: data.personalRatings! }));
        }
        if (data.movie) {
          const updated = data.movie;
          setMovies((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        }
      } catch {
        setPrefs((prev) => ({ ...prev, personalRatings: previousRatings }));
      }
    },
    [authUser, authHeaders, openLoginPrompt, prefs.personalRatings]
  );

  const handleChangePalette = useCallback(
    async (palette: ThemePaletteId) => {
      setPrefs((prev) => ({ ...prev, palette }));

      if (!authUser) return;
      try {
        await fetch('/api/user/activity', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'CineRoda',
            ...authHeaders,
          },
          body: JSON.stringify({ action: 'setPalette', palette }),
        });
      } catch {
        // Ignora erro momentâneo ao persistir paleta
      }
    },
    [authUser, authHeaders]
  );

  const handleEvaluateMovie = async (movieId: string, choice: EvaluationChoice) => {
    if (!authUser) {
      openLoginPrompt('Entre ou crie uma conta para registrar seu Gostei ou Não gostei.');
      return;
    }

    try {
      const res = await fetch(`/api/movies/${encodeURIComponent(movieId)}/evaluate`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'CineRoda',
          ...authHeaders,
        },
        body: JSON.stringify({ choice }),
      });
      if (res.status === 401) {
        openLoginPrompt('Sua sessão expirou. Entre novamente para avaliar.');
        return;
      }
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

  const handleAddComment = async (movieId: string, text: string): Promise<boolean> => {
    if (!authUser) {
      openLoginPrompt('Entre na sua conta para comentar sobre este filme.');
      return false;
    }

    try {
      const res = await fetch('/api/user/activity', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'CineRoda',
          ...authHeaders,
        },
        body: JSON.stringify({ action: 'addComment', movieId, text }),
      });
      if (res.status === 401) {
        openLoginPrompt('Sua sessão expirou. Entre novamente para comentar.');
        return false;
      }
      if (!res.ok) return false;
      const data = (await res.json()) as { movie?: MovieItem };
      if (data.movie) {
        const updated = data.movie;
        setMovies((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      }
      return true;
    } catch {
      return false;
    }
  };

  const handleDeleteComment = async (movieId: string, commentId: string) => {
    if (!authUser) return;

    try {
      const res = await fetch('/api/user/activity', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'CineRoda',
          ...authHeaders,
        },
        body: JSON.stringify({ action: 'deleteComment', movieId, commentId }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { movie?: MovieItem };
      if (data.movie) {
        const updated = data.movie;
        setMovies((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      }
    } catch {
      // Falha silenciosa
    }
  };

  const handleSendChatMessage = async (
    text: string,
    movieIdToAttach?: string,
    replyToId?: string
  ): Promise<boolean> => {
    if (!authUser) {
      openLoginPrompt('Entre na sua conta para participar do chat da comunidade.');
      return false;
    }
    const msgId = `msg-${authUser.id.slice(0, 6)}-${Date.now()}`;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'CineRoda',
          ...authHeaders,
        },
        body: JSON.stringify({
          id: msgId,
          text,
          attachedMovieId: movieIdToAttach,
          replyToId,
        }),
      });
      if (res.status === 401) {
        openLoginPrompt('Sua sessão expirou. Entre novamente para enviar mensagens.');
        return false;
      }
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

  const handleToggleChatReaction = async (
    messageId: string,
    reaction: ChatReactionKey
  ) => {
    if (!authUser) {
      openLoginPrompt('Entre na sua conta para reagir às mensagens do chat.');
      return;
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'CineRoda',
          ...authHeaders,
        },
        body: JSON.stringify({ messageId, reaction }),
      });
      if (res.status === 401) {
        openLoginPrompt('Sua sessão expirou. Entre novamente para reagir.');
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as { message?: ChatMessage };
      if (data.message) {
        const updatedMsg = data.message;
        setMessages((prev) => prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m)));
      }
    } catch {
      // Falha silenciosa
    }
  };

  const handleDeleteChatMessage = async (messageId: string) => {
    if (!authUser) return;
    try {
      const res = await fetch(`/api/chat?id=${encodeURIComponent(messageId)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'X-Requested-With': 'CineRoda',
          ...authHeaders,
        },
      });
      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
    } catch {
      // Falha silenciosa
    }
  };

  const handleOpenRecommendModal = useCallback(() => {
    if (!authUser) {
      openLoginPrompt('Entre ou crie uma conta para indicar um novo filme ao catálogo.');
      return;
    }
    setEditingMovie(null);
    setIsRecommendOpen(true);
  }, [authUser, openLoginPrompt]);

  const handleStartEditMovie = useCallback((movie: MovieItem) => {
    setSelectedMovieId(null);
    setEditingMovie(movie);
    setIsRecommendOpen(true);
  }, []);

  const handleDeleteMovie = useCallback(
    async (movieId: string) => {
      if (!authUser) return;
      try {
        const res = await fetch(`/api/movies/${encodeURIComponent(movieId)}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'X-Requested-With': 'CineRoda',
            ...authHeaders,
          },
        });
        if (!res.ok) return;
        setMovies((prev) => prev.filter((m) => m.id !== movieId));
        setPrefs((prev) => {
          const nextRatings = { ...prev.personalRatings };
          delete nextRatings[movieId];
          return {
            ...prev,
            watchlistIds: prev.watchlistIds.filter((id) => id !== movieId),
            personalRatings: nextRatings,
          };
        });
        setSelectedMovieId((curr) => (curr === movieId ? null : curr));
        setAttachedMovieId((curr) => (curr === movieId ? null : curr));
      } catch {
        // Falha silenciosa
      }
    },
    [authUser, authHeaders]
  );

  const handleMovieCreated = async (newMovie: MovieItem, shareInChat: boolean) => {
    setMovies((prev) => (prev.some((m) => m.id === newMovie.id) ? prev : [newMovie, ...prev]));
    setPrefs((prev) => ({
      ...prev,
      personalRatings: {
        ...prev.personalRatings,
        [newMovie.id]: Math.round(newMovie.authorRating ?? newMovie.rating),
      },
    }));

    if (shareInChat && authUser) {
      await fetch('/api/chat', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'CineRoda',
          ...authHeaders,
        },
        body: JSON.stringify({
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          text: `Acabei de adicionar "${newMovie.title}" no catálogo! ${newMovie.recommendationNote}`,
          attachedMovieId: newMovie.id,
        }),
      });
      syncCatalogAndChat(false);
    }
  };

  const handleMovieUpdated = useCallback((updatedMovie: MovieItem) => {
    setMovies((prev) => prev.map((m) => (m.id === updatedMovie.id ? updatedMovie : m)));
    setPrefs((prev) => ({
      ...prev,
      personalRatings: {
        ...prev.personalRatings,
        [updatedMovie.id]: Math.round(updatedMovie.authorRating ?? updatedMovie.rating),
      },
    }));
  }, []);

  const handleRecommendInChat = (movie: MovieItem) => {
    if (!authUser) {
      openLoginPrompt('Entre na sua conta para recomendar esse filme no chat.');
      return;
    }
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

  const showSpotlight =
    activeView === 'catalogo' &&
    !searchQuery.trim() &&
    prefs.activeGenre === 'Todos' &&
    !loading &&
    !loadError &&
    featuredMovie !== null;

  const isFilteredListEmpty =
    activeView === 'lista' && Boolean(authUser) && activeWatchlistIds.length > 0;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--cr-canvas)] text-[var(--cr-ink)] transition-colors duration-200">
      <Header
        activeView={activeView}
        onSelectView={handleSelectView}
        watchlistCount={activeWatchlistIds.length}
        chatMessagesCount={messages.length}
        authUser={authUser}
        onOpenAuthModal={() => openLoginPrompt('')}
        onOpenRecommendModal={handleOpenRecommendModal}
      />

      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {/* Destaque editorial da comunidade (quando no catálogo geral) */}
        {showSpotlight && featuredMovie && (
          <section
            aria-label="Filme em destaque da comunidade"
            style={{ backgroundColor: 'var(--cr-spotlight)' }}
            className="mb-8 overflow-hidden rounded-2xl text-white shadow-[0_20px_50px_-24px_rgba(15,23,42,0.55)] dark:border dark:border-[var(--cr-border)]"
          >
            <div
              style={{
                backgroundImage:
                  'radial-gradient(ellipse at top left, var(--cr-spotlight-glow), transparent 58%)',
              }}
              className="flex flex-col justify-between p-6 sm:p-8 lg:p-10"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-300">
                  <span
                    style={{ color: 'var(--cr-spotlight-kicker)' }}
                    className="font-semibold"
                  >
                    Destaque da Comunidade
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{featuredMovie.genre}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{featuredMovie.year}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{featuredMovie.durationMinutes} min</span>
                </div>

                <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl [text-wrap:balance]">
                  {featuredMovie.title}
                </h2>

                <p className="mt-1.5 text-xs sm:text-sm text-slate-300">
                  Direção de {featuredMovie.director} · Indicado por {featuredMovie.recommendedBy}
                </p>

                <p className="mt-4 max-w-3xl font-editorial text-base italic leading-relaxed text-slate-100 sm:text-lg">
                  “{featuredMovie.recommendationNote}”
                </p>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-5">
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 tabular-nums">
                  <span className="inline-flex items-center gap-1.5 font-mono text-sm font-semibold text-white">
                    <Star className="h-4 w-4 fill-[#F59E0B] text-[#F59E0B]" aria-hidden="true" />
                    <span>{featuredMovie.rating.toFixed(1)}/5</span>
                    <span className="text-xs font-normal text-slate-300">
                      ({featuredMovie.ratingsCount ?? 1}{' '}
                      {(featuredMovie.ratingsCount ?? 1) === 1 ? 'avaliação' : 'avaliações'})
                    </span>
                  </span>
                  <span aria-hidden="true" className="text-white/25">
                    ·
                  </span>
                  <span className="font-mono">
                    {featuredMovie.likedBy.length} curtidas da comunidade
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedMovieId(featuredMovie.id)}
                    className="inline-flex min-h-[42px] items-center justify-center rounded-xl bg-[var(--cr-accent)] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--cr-accent-hover)] whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Ver detalhes e avaliar
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleWatchlist(featuredMovie.id)}
                    className={`inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      activeWatchlistIds.includes(featuredMovie.id)
                        ? 'border-white/30 bg-white text-[#111827]'
                        : 'border-white/20 bg-white/10 text-white hover:bg-white/15'
                    }`}
                  >
                    <Bookmark
                      className={`h-3.5 w-3.5 ${
                        activeWatchlistIds.includes(featuredMovie.id) ? 'fill-[#111827]' : ''
                      }`}
                      aria-hidden="true"
                    />
                    <span>
                      {activeWatchlistIds.includes(featuredMovie.id)
                        ? 'Salvo na Lista'
                        : 'Salvar na Lista'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Cabeçalho editorial + resumo rápido + conta + seletor de paleta */}
        <div className="mb-6 flex flex-col gap-5 border-b border-[var(--cr-border)] pb-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--cr-ink)] sm:text-3xl [text-wrap:balance]">
                {activeView === 'lista'
                  ? 'Sua Lista para Assistir Depois'
                  : 'Catálogo Colaborativo de Filmes'}
              </h1>
              <p className="mt-1.5 text-sm text-[var(--cr-ink-secondary)]">
                Explore indicações da comunidade, avalie seus filmes favoritos e converse no chat.
              </p>
            </div>

            <dl className="flex items-center gap-6 text-xs text-[var(--cr-ink-muted)] shrink-0">
              <div>
                <dt>Filmes no catálogo</dt>
                <dd className="mt-0.5 font-display text-xl font-bold text-[var(--cr-ink)] tabular-nums">
                  {movies.length}
                </dd>
              </div>
              <div className="h-8 w-px bg-[var(--cr-border)]" aria-hidden="true" />
              <div>
                <dt>Média geral</dt>
                <dd className="mt-0.5 font-display text-xl font-bold text-[var(--cr-ink)] tabular-nums">
                  {averageRating}/5
                </dd>
              </div>
              <div className="h-8 w-px bg-[var(--cr-border)]" aria-hidden="true" />
              <div>
                <dt>Na sua lista</dt>
                <dd className="mt-0.5 font-display text-xl font-bold text-[var(--cr-accent)] tabular-nums">
                  {activeWatchlistIds.length}
                </dd>
              </div>
            </dl>
          </div>

          {/* Barra de conta sincronizada + Seletor de paleta de cores */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {authChecked && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--cr-border)] bg-[var(--cr-surface)] px-3.5 py-2.5 text-xs">
                {authUser ? (
                  <>
                    <div className="flex items-center gap-2 text-[var(--cr-ink)]">
                      <UserCheck className="h-4 w-4 text-[#059669]" aria-hidden="true" />
                      <span>
                        Conectado como <strong>{authUser.name}</strong>
                      </span>
                      <span className="hidden sm:inline text-[var(--cr-ink-muted)]">
                        · Atividade salva no seu login
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => openLoginPrompt('')}
                      className="ml-auto font-semibold text-[var(--cr-accent)] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Minha conta
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-[var(--cr-ink-secondary)]">
                      Entre para salvar sua lista, avaliações e preferências no seu login.
                    </span>
                    <button
                      type="button"
                      onClick={() => openLoginPrompt('')}
                      className="ml-auto inline-flex items-center gap-1.5 font-semibold text-[var(--cr-accent)] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Entrar ou criar conta</span>
                    </button>
                  </>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-medium text-[var(--cr-ink-secondary)]">
                <Palette className="h-4 w-4 text-[var(--cr-accent)]" aria-hidden="true" />
                <span>Paleta do site</span>
              </div>

              <div
                role="group"
                aria-label="Escolher paleta de cores do site"
                className="flex flex-wrap items-center gap-1.5 rounded-xl bg-[var(--cr-surface-alt)] p-1"
              >
                {THEME_PALETTES.map((option) => {
                  const isSelected = prefs.palette === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => handleChangePalette(option.id)}
                      className={`inline-flex min-h-[36px] items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--cr-surface)] text-[var(--cr-ink)] font-semibold shadow-xs'
                          : 'text-[var(--cr-ink-secondary)] hover:text-[var(--cr-ink)]'
                      }`}
                    >
                      <span className="inline-flex items-center -space-x-1" aria-hidden="true">
                        <span
                          className="h-3.5 w-3.5 rounded-full border border-black/15"
                          style={{ backgroundColor: option.canvasColor }}
                        />
                        <span
                          className="h-3.5 w-3.5 rounded-full border border-white/60"
                          style={{ backgroundColor: option.accentColor }}
                        />
                      </span>
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Layout principal: Catálogo (8 colunas) + Chat (4 colunas) */}
        <div className="grid grid-cols-1 gap-7 lg:grid-cols-12 lg:items-start">
          {/* Coluna do catálogo (oculta no celular quando a aba Chat estiver ativa) */}
          <div
            className={`lg:col-span-8 space-y-6 ${
              activeView === 'chat' ? 'hidden lg:block' : 'block'
            }`}
          >
            {/* Busca, ordenação e abas de gênero */}
            <div className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="relative min-w-[200px] flex-1">
                  <Search
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cr-ink-muted)]"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por título, direção ou quem indicou..."
                    aria-label="Buscar filmes"
                    className="min-h-[42px] w-full rounded-xl border border-[var(--cr-border)] bg-[var(--cr-surface)] pl-10 pr-4 text-sm text-[var(--cr-ink)] shadow-2xs placeholder:text-[var(--cr-ink-muted)] focus:border-[var(--cr-accent)] focus:outline-none"
                  />
                </div>

                <select
                  aria-label="Ordenar filmes"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="min-h-[42px] rounded-xl border border-[var(--cr-border)] bg-[var(--cr-surface)] px-3.5 text-sm font-medium text-[var(--cr-ink-secondary)] shadow-2xs focus:border-[var(--cr-accent)] focus:outline-none cursor-pointer"
                >
                  <option value="recentes">Mais recentes</option>
                  <option value="votos">Mais recomendados</option>
                  <option value="nota">Maior nota</option>
                </select>

                <button
                  type="button"
                  onClick={() => setIsPickerOpen(true)}
                  className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-[var(--cr-border)] bg-[var(--cr-surface)] px-3.5 text-sm font-semibold text-[var(--cr-ink)] transition-colors hover:bg-[var(--cr-surface-hover)] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Sparkles className="h-4 w-4 text-[var(--cr-accent)]" aria-hidden="true" />
                  <span>Me indica um filme</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenRecommendModal}
                  className="min-h-[42px] rounded-xl border border-[var(--cr-accent-border)] bg-[var(--cr-accent-soft)] px-4 text-sm font-semibold text-[var(--cr-accent-text)] transition-colors hover:opacity-90 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  + Indicar Filme
                </button>
              </div>

              <div
                role="tablist"
                aria-label="Filtrar por gênero"
                className="flex items-center gap-1.5 overflow-x-auto rounded-xl bg-[var(--cr-surface-alt)] p-1"
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
                      className={`min-h-[36px] rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                        isActive
                          ? 'bg-[var(--cr-surface)] text-[var(--cr-ink)] font-semibold shadow-xs'
                          : 'text-[var(--cr-ink-secondary)] hover:text-[var(--cr-ink)]'
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
                    className="h-[420px] animate-pulse rounded-2xl border border-[var(--cr-border)] bg-[var(--cr-surface)]"
                  />
                ))}
              </div>
            ) : loadError ? (
              <div className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-6 text-sm text-[#991B1B] dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-200">
                {loadError}
              </div>
            ) : visibleMovies.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--cr-border-strong)] bg-[var(--cr-surface)] p-10 text-center">
                <Film className="mx-auto h-8 w-8 text-[var(--cr-ink-muted)]" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold text-[var(--cr-ink)]">
                  {activeView === 'lista'
                    ? !authUser
                      ? 'Entre na sua conta para ver sua lista salva.'
                      : isFilteredListEmpty
                        ? 'Nenhum filme da sua lista corresponde aos filtros atuais.'
                        : 'Sua lista ainda está vazia.'
                    : 'Nenhum filme encontrado com esses filtros.'}
                </p>
                <p className="mt-1 text-xs text-[var(--cr-ink-muted)]">
                  {activeView === 'lista'
                    ? !authUser
                      ? 'Com o login, os filmes que você salvar ficam disponíveis em qualquer dispositivo.'
                      : isFilteredListEmpty
                        ? 'Limpe a busca ou troque o gênero selecionado para ver seus filmes salvos.'
                        : 'Clique em "Salvar" nos filmes do catálogo para montar sua lista pessoal.'
                    : 'Tente limpar a busca ou indique um novo filme para a comunidade.'}
                </p>
                <div className="mt-4 flex justify-center gap-3">
                  {activeView === 'lista' && !authUser ? (
                    <button
                      type="button"
                      onClick={() =>
                        openLoginPrompt('Entre para acessar e salvar filmes na sua lista.')
                      }
                      className="min-h-[40px] rounded-lg bg-[var(--cr-accent)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--cr-accent-hover)] cursor-pointer"
                    >
                      Entrar ou criar conta
                    </button>
                  ) : activeView === 'lista' && !isFilteredListEmpty ? (
                    <button
                      type="button"
                      onClick={() => setActiveView('catalogo')}
                      className="min-h-[40px] rounded-lg bg-[var(--cr-accent)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--cr-accent-hover)] cursor-pointer"
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
                      className="min-h-[40px] rounded-lg border border-[var(--cr-border)] bg-[var(--cr-surface)] px-4 py-2 text-xs font-semibold text-[var(--cr-ink)] hover:bg-[var(--cr-surface-hover)] cursor-pointer"
                    >
                      Limpar Filtros
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {paginatedMovies.map((movie) => (
                    <MovieCard
                      key={movie.id}
                      movie={movie}
                      isSaved={activeWatchlistIds.includes(movie.id)}
                      hasLiked={Boolean(activeUserKey && movie.likedBy.includes(activeUserKey))}
                      hasDisliked={Boolean(
                        activeUserKey && movie.dislikedBy.includes(activeUserKey)
                      )}
                      personalRating={activePersonalRatings[movie.id]}
                      onToggleWatchlist={handleToggleWatchlist}
                      onEvaluateMovie={handleEvaluateMovie}
                      onOpenDetail={(m) => setSelectedMovieId(m.id)}
                    />
                  ))}
                </div>

                {visibleMovies.length > MOVIES_PAGE_SIZE && (
                  <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-[var(--cr-border)] bg-[var(--cr-surface)] px-4 py-3 sm:flex-row">
                    <span className="text-xs text-[var(--cr-ink-muted)] tabular-nums">
                      Exibindo {paginatedMovies.length} de {visibleMovies.length} filmes
                    </span>

                    {remainingMoviesCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => setDisplayLimit((prev) => prev + MOVIES_PAGE_SIZE)}
                        className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-[var(--cr-border)] bg-[var(--cr-surface-hover)] px-4 py-2 text-xs font-semibold text-[var(--cr-ink)] transition-colors hover:border-[var(--cr-accent-border)] hover:text-[var(--cr-accent)] whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Carregar mais ({Math.min(MOVIES_PAGE_SIZE, remainingMoviesCount)}{' '}
                        {Math.min(MOVIES_PAGE_SIZE, remainingMoviesCount) === 1 ? 'filme' : 'filmes'})
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDisplayLimit(MOVIES_PAGE_SIZE)}
                        className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-[var(--cr-border)] bg-[var(--cr-surface)] px-4 py-2 text-xs font-semibold text-[var(--cr-ink-secondary)] transition-colors hover:text-[var(--cr-ink)] whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Mostrar menos
                      </button>
                    )}
                  </div>
                )}
              </>
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
              authUser={authUser}
              onOpenAuthModal={() =>
                openLoginPrompt('Entre ou crie sua conta para conversar no chat.')
              }
              attachedMovieId={attachedMovieId}
              onChangeAttachedMovieId={setAttachedMovieId}
              onSendMessage={handleSendChatMessage}
              onToggleReaction={handleToggleChatReaction}
              onDeleteMessage={handleDeleteChatMessage}
              onSelectMovie={(m) => setSelectedMovieId(m.id)}
              isConnected={isConnected}
            />
          </div>
        </div>
      </main>

      <Footer />

      <MovieDetailModal
        movie={selectedMovie}
        authUser={authUser}
        isSaved={selectedMovie ? activeWatchlistIds.includes(selectedMovie.id) : false}
        hasLiked={Boolean(
          selectedMovie && activeUserKey && selectedMovie.likedBy.includes(activeUserKey)
        )}
        hasDisliked={Boolean(
          selectedMovie && activeUserKey && selectedMovie.dislikedBy.includes(activeUserKey)
        )}
        personalRating={
          selectedMovie ? activePersonalRatings[selectedMovie.id] : undefined
        }
        onClose={() => setSelectedMovieId(null)}
        onToggleWatchlist={handleToggleWatchlist}
        onEvaluateMovie={handleEvaluateMovie}
        onRateMovie={handleRateMovie}
        onRecommendInChat={handleRecommendInChat}
        onEditMovie={handleStartEditMovie}
        onDeleteMovie={handleDeleteMovie}
        onAddComment={handleAddComment}
        onDeleteComment={handleDeleteComment}
        onOpenAuthModal={openLoginPrompt}
      />

      <RecommendMovieModal
        isOpen={isRecommendOpen}
        authUser={authUser}
        authHeaders={authHeaders}
        editingMovie={editingMovie}
        onClose={() => {
          setIsRecommendOpen(false);
          setEditingMovie(null);
        }}
        onMovieCreated={handleMovieCreated}
        onMovieUpdated={handleMovieUpdated}
        onOpenExistingMovie={(movieId) => setSelectedMovieId(movieId)}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        promptReason={authPromptReason}
        currentPalette={prefs.palette}
        authUser={authUser}
        authHeaders={authHeaders}
        watchlistCount={activeWatchlistIds.length}
        ratingsCount={Object.keys(activePersonalRatings).length}
        authoredCount={authoredMoviesCount}
        onClose={() => {
          setIsAuthModalOpen(false);
          setAuthPromptReason('');
        }}
        onAuthSuccess={handleAuthSuccess}
        onProfileUpdated={handleProfileUpdated}
        onLogout={handleLogout}
      />

      <MoviePickerModal
        isOpen={isPickerOpen}
        movies={movies}
        watchlistIds={activeWatchlistIds}
        isLoggedIn={Boolean(authUser)}
        onClose={() => setIsPickerOpen(false)}
        onSelectMovie={(m) => setSelectedMovieId(m.id)}
        onToggleWatchlist={handleToggleWatchlist}
      />
    </div>
  );
}
