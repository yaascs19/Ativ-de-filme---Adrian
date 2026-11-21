import {
  createChatMessage,
  createMovie,
  evaluateMovie,
  getHealthStatus,
  getSqlDiagnostics,
  listChatMessages,
  listMovies,
  MovieGenre,
  sanitizePosterUrl,
  sanitizeText,
  VALID_GENRES,
} from './db';

function formatDbError(err: unknown): { code?: string; message: string } {
  if (err && typeof err === 'object') {
    const e = err as { code?: unknown; message?: unknown };
    return {
      code: typeof e.code === 'string' ? e.code : undefined,
      message: typeof e.message === 'string' ? e.message.slice(0, 220) : 'Erro desconhecido.',
    };
  }
  return { message: 'Erro desconhecido.' };
}

export interface ApiRequest {
  method?: string;
  body?: unknown;
  query?: Record<string, unknown>;
  params?: Record<string, string | undefined>;
}

export interface ApiResponse {
  status: (code: number) => ApiResponse;
  json: (payload: unknown) => void;
}

export async function handleHealthRequest(_req: ApiRequest, res: ApiResponse): Promise<void> {
  try {
    const status = await getHealthStatus();
    res.status(200).json({ ...status, diagnostics: getSqlDiagnostics() });
  } catch (err) {
    console.error('[api/health] Erro SQL:', err);
    res.status(500).json({
      ok: false,
      error: 'Erro ao verificar conexão com o banco.',
      details: formatDbError(err),
      diagnostics: getSqlDiagnostics(),
    });
  }
}

export async function handleMoviesRequest(req: ApiRequest, res: ApiResponse): Promise<void> {
  try {
    if (req.method === 'GET') {
      const movies = await listMovies();
      res.status(200).json({ movies });
      return;
    }

    if (req.method === 'POST') {
      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<
        string,
        unknown
      >;
      const title = sanitizeText(body.title, 100);
      const director = sanitizeText(body.director, 80);
      const synopsis = sanitizeText(body.synopsis, 400);
      const recommendedBy = sanitizeText(body.recommendedBy, 40);
      const recommendationNote = sanitizeText(body.recommendationNote, 240);
      const genre = body.genre as MovieGenre;
      const year = Number(body.year);
      const durationMinutes = Number(body.durationMinutes);
      const rating = Number(body.rating);
      const safePoster = sanitizePosterUrl(body.posterUrl);
      const clientId = sanitizeText(body.clientId, 64) || recommendedBy;

      if (
        title.length < 2 ||
        director.length < 2 ||
        synopsis.length < 10 ||
        recommendedBy.length < 2
      ) {
        res.status(400).json({ error: 'Preencha título, direção, sinopse e seu nome.' });
        return;
      }

      if (!VALID_GENRES.includes(genre)) {
        res.status(400).json({ error: 'Gênero inválido.' });
        return;
      }

      if (!Number.isFinite(year) || year < 1900 || year > 2030) {
        res.status(400).json({ error: 'Informe um ano válido entre 1900 e 2030.' });
        return;
      }

      const safeDuration =
        Number.isFinite(durationMinutes) && durationMinutes >= 30 && durationMinutes <= 400
          ? Math.round(durationMinutes)
          : 110;
      const safeRating =
        Number.isFinite(rating) && rating >= 1 && rating <= 5
          ? Math.round(rating * 10) / 10
          : 4.5;

      const newMovie = await createMovie({
        title,
        director,
        year: Math.round(year),
        durationMinutes: safeDuration,
        genre,
        synopsis,
        recommendedBy,
        recommendationNote:
          recommendationNote || 'Indicado diretamente pela comunidade CineRoda.',
        posterUrl: safePoster,
        rating: safeRating,
        clientId,
      });

      res.status(201).json({ movie: newMovie });
      return;
    }

    res.status(405).json({ error: 'Método não permitido.' });
  } catch (err) {
    console.error('[api/movies] Erro SQL:', err);
    res.status(500).json({
      error: 'Erro interno ao processar filmes no banco.',
      details: formatDbError(err),
    });
  }
}

export async function handleEvaluateMovieRequest(
  req: ApiRequest,
  res: ApiResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  try {
    const rawId = req.params?.id ?? req.query?.id;
    const movieId = sanitizeText(Array.isArray(rawId) ? rawId[0] : rawId, 64);
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<
      string,
      unknown
    >;
    const clientId = sanitizeText(body.clientId, 64);
    const choice = body.choice === 'dislike' ? 'dislike' : 'like';

    if (!movieId || !clientId) {
      res.status(400).json({ error: 'Identificador do filme e do usuário são obrigatórios.' });
      return;
    }

    const updatedMovie = await evaluateMovie(movieId, clientId, choice);
    if (!updatedMovie) {
      res.status(404).json({ error: 'Filme não encontrado.' });
      return;
    }

    res.status(200).json({ movie: updatedMovie });
  } catch {
    res.status(500).json({ error: 'Erro interno ao registrar avaliação.' });
  }
}

export async function handleChatRequest(req: ApiRequest, res: ApiResponse): Promise<void> {
  try {
    if (req.method === 'GET') {
      const messages = await listChatMessages();
      res.status(200).json({ messages });
      return;
    }

    if (req.method === 'POST') {
      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<
        string,
        unknown
      >;
      const author = sanitizeText(body.author, 40);
      const text = sanitizeText(body.text, 400);
      const clientMsgId = sanitizeText(body.id, 64);
      const attachedMovieId = sanitizeText(body.attachedMovieId, 64);

      if (author.length < 2 || text.length < 1) {
        res.status(400).json({ error: 'Informe seu nome e escreva uma mensagem.' });
        return;
      }

      const message = await createChatMessage({
        clientMsgId: clientMsgId || undefined,
        author,
        text,
        attachedMovieId: attachedMovieId || undefined,
      });

      res.status(201).json({ message });
      return;
    }

    res.status(405).json({ error: 'Método não permitido.' });
  } catch (err) {
    console.error('[api/chat] Erro SQL:', err);
    res.status(500).json({
      error: 'Erro interno ao processar mensagens do chat.',
      details: formatDbError(err),
    });
  }
}
