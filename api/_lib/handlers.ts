import {
  AuthUserRecord,
  createChatMessage,
  createMovie,
  evaluateMovie,
  getHealthStatus,
  getSessionUser,
  getSqlDiagnostics,
  isValidEmail,
  listChatMessages,
  listMovies,
  loginUserAccount,
  logoutSession,
  MovieGenre,
  registerUserAccount,
  sanitizeEmail,
  sanitizePalette,
  sanitizePosterUrl,
  sanitizeText,
  saveUserMovieRating,
  toggleUserWatchlist,
  updateUserPalette,
  UserActivityRecord,
  VALID_GENRES,
  VALID_PALETTES,
} from './db.js';

const SESSION_COOKIE_NAME = 'cineroda_session';
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

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
  headers?: Record<string, string | string[] | undefined>;
}

export interface ApiResponse {
  status: (code: number) => ApiResponse;
  json: (payload: unknown) => void;
  setHeader?: (name: string, value: string | string[]) => void;
}

function getHeader(req: ApiRequest, name: string): string {
  const raw = req.headers?.[name.toLowerCase()] ?? req.headers?.[name];
  if (Array.isArray(raw)) return raw[0] || '';
  return typeof raw === 'string' ? raw : '';
}

function parseCookies(cookieHeader: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    try {
      result[key] = decodeURIComponent(val);
    } catch {
      result[key] = val;
    }
  }
  return result;
}

function extractSessionToken(req: ApiRequest): { token: string; viaCookie: boolean } {
  const authHeader = getHeader(req, 'authorization').trim();
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) {
      return { token: bearer, viaCookie: false };
    }
  }
  const cookies = parseCookies(getHeader(req, 'cookie'));
  const cookieToken = cookies[SESSION_COOKIE_NAME] || '';
  return { token: cookieToken, viaCookie: Boolean(cookieToken) };
}

function isSecureRequest(req: ApiRequest): boolean {
  const proto = getHeader(req, 'x-forwarded-proto').toLowerCase();
  if (proto === 'https') return true;
  if (process.env.VERCEL === '1') return true;
  return false;
}

function setSessionCookie(req: ApiRequest, res: ApiResponse, token: string): void {
  if (!res.setHeader) return;
  const secure = isSecureRequest(req);
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${SESSION_COOKIE_MAX_AGE}`,
    'HttpOnly',
    secure ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (secure) {
    parts.push('Secure', 'Partitioned');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(req: ApiRequest, res: ApiResponse): void {
  if (!res.setHeader) return;
  const secure = isSecureRequest(req);
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    secure ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (secure) {
    parts.push('Secure', 'Partitioned');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

function verifyCsrfIfCookieAuth(req: ApiRequest, viaCookie: boolean): boolean {
  if (!viaCookie) return true;
  const requestedWith = getHeader(req, 'x-requested-with');
  if (requestedWith === 'CineRoda') return true;

  const origin = getHeader(req, 'origin');
  const host = (getHeader(req, 'x-forwarded-host') || getHeader(req, 'host')).split(',')[0].trim();
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost === host) return true;
    } catch {
      return false;
    }
  }
  return false;
}

async function resolveAuthenticatedSession(req: ApiRequest): Promise<{
  session: { user: AuthUserRecord; activity: UserActivityRecord } | null;
  viaCookie: boolean;
  csrfOk: boolean;
}> {
  const { token, viaCookie } = extractSessionToken(req);
  if (!token) {
    return { session: null, viaCookie: false, csrfOk: true };
  }
  const csrfOk = verifyCsrfIfCookieAuth(req, viaCookie);
  if (!csrfOk) {
    return { session: null, viaCookie, csrfOk: false };
  }
  const session = await getSessionUser(token);
  return { session, viaCookie, csrfOk: true };
}

// ---------------------------------------------------------------------------
// Endpoints de saúde
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Endpoints de autenticação (/api/auth/:action)
// ---------------------------------------------------------------------------

export async function handleAuthRequest(req: ApiRequest, res: ApiResponse): Promise<void> {
  try {
    const rawAction = req.params?.action ?? req.query?.action;
    const action = sanitizeText(Array.isArray(rawAction) ? rawAction[0] : rawAction, 32);

    if (action === 'me' && req.method === 'GET') {
      const { token } = extractSessionToken(req);
      if (!token) {
        res.status(200).json({ user: null, activity: null });
        return;
      }
      const session = await getSessionUser(token);
      if (!session) {
        clearSessionCookie(req, res);
        res.status(200).json({ user: null, activity: null });
        return;
      }
      res.status(200).json({ user: session.user, activity: session.activity });
      return;
    }

    if (action === 'register' && req.method === 'POST') {
      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<
        string,
        unknown
      >;
      const name = sanitizeText(body.name, 40);
      const email = sanitizeEmail(body.email);
      const password = typeof body.password === 'string' ? body.password : '';
      const palette = sanitizePalette(body.palette);

      if (name.length < 2) {
        res.status(400).json({ error: 'Informe seu nome com pelo menos 2 caracteres.' });
        return;
      }
      if (!isValidEmail(email)) {
        res.status(400).json({ error: 'Informe um e-mail válido.' });
        return;
      }
      if (password.length < 6 || password.length > 100) {
        res.status(400).json({ error: 'A senha deve ter entre 6 e 100 caracteres.' });
        return;
      }

      const created = await registerUserAccount({ name, email, password, palette });
      if (!created.ok) {
        res.status(409).json({ error: 'Já existe uma conta cadastrada com este e-mail.' });
        return;
      }

      setSessionCookie(req, res, created.sessionToken);
      res.status(201).json({
        user: created.user,
        activity: created.activity,
        sessionToken: created.sessionToken,
      });
      return;
    }

    if (action === 'login' && req.method === 'POST') {
      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<
        string,
        unknown
      >;
      const email = sanitizeEmail(body.email);
      const password = typeof body.password === 'string' ? body.password : '';

      if (!isValidEmail(email) || password.length < 1) {
        res.status(400).json({ error: 'Informe seu e-mail e senha.' });
        return;
      }

      const loggedIn = await loginUserAccount({ email, password });
      if (!loggedIn) {
        res.status(401).json({ error: 'E-mail ou senha incorretos.' });
        return;
      }

      setSessionCookie(req, res, loggedIn.sessionToken);
      res.status(200).json({
        user: loggedIn.user,
        activity: loggedIn.activity,
        sessionToken: loggedIn.sessionToken,
      });
      return;
    }

    if (action === 'logout' && req.method === 'POST') {
      const { token, viaCookie } = extractSessionToken(req);
      if (viaCookie && !verifyCsrfIfCookieAuth(req, viaCookie)) {
        res.status(403).json({ error: 'Requisição bloqueada por proteção CSRF.' });
        return;
      }
      if (token) {
        await logoutSession(token);
      }
      clearSessionCookie(req, res);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(404).json({ error: 'Rota de autenticação inválida.' });
  } catch (err) {
    console.error('[api/auth] Erro:', err);
    res.status(500).json({
      error: 'Erro interno na autenticação.',
      details: formatDbError(err),
    });
  }
}

// ---------------------------------------------------------------------------
// Endpoint de atividade pessoal salva na conta (/api/user/activity)
// ---------------------------------------------------------------------------

export async function handleUserActivityRequest(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  try {
    const auth = await resolveAuthenticatedSession(req);
    if (!auth.csrfOk) {
      res.status(403).json({ error: 'Requisição bloqueada por proteção CSRF.' });
      return;
    }
    if (!auth.session) {
      res.status(401).json({ error: 'Faça login para salvar sua atividade.' });
      return;
    }

    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<
      string,
      unknown
    >;
    const action = sanitizeText(body.action, 32);

    if (action === 'toggleWatchlist') {
      const movieId = sanitizeText(body.movieId, 64);
      if (!movieId) {
        res.status(400).json({ error: 'Identificador do filme é obrigatório.' });
        return;
      }
      const watchlistIds = await toggleUserWatchlist(auth.session.user.userKey, movieId);
      if (!watchlistIds) {
        res.status(404).json({ error: 'Filme não encontrado.' });
        return;
      }
      res.status(200).json({ watchlistIds });
      return;
    }

    if (action === 'rateMovie') {
      const movieId = sanitizeText(body.movieId, 64);
      const rating = Number(body.rating);
      if (!movieId || !Number.isFinite(rating) || rating < 1 || rating > 5) {
        res.status(400).json({ error: 'Informe uma nota entre 1 e 5.' });
        return;
      }
      const result = await saveUserMovieRating(
        auth.session.user.userKey,
        movieId,
        rating
      );
      if (!result) {
        res.status(404).json({ error: 'Filme não encontrado.' });
        return;
      }
      res.status(200).json(result);
      return;
    }

    if (action === 'setPalette') {
      const rawPalette = sanitizeText(body.palette, 20);
      if (!VALID_PALETTES.includes(rawPalette as (typeof VALID_PALETTES)[number])) {
        res.status(400).json({ error: 'Paleta inválida.' });
        return;
      }
      const palette = await updateUserPalette(
        auth.session.user.id,
        sanitizePalette(rawPalette)
      );
      res.status(200).json({ palette });
      return;
    }

    res.status(400).json({ error: 'Ação inválida.' });
  } catch (err) {
    console.error('[api/user/activity] Erro:', err);
    res.status(500).json({
      error: 'Erro interno ao salvar atividade da conta.',
      details: formatDbError(err),
    });
  }
}

// ---------------------------------------------------------------------------
// Endpoints de filmes, avaliações e chat
// ---------------------------------------------------------------------------

export async function handleMoviesRequest(req: ApiRequest, res: ApiResponse): Promise<void> {
  try {
    if (req.method === 'GET') {
      const movies = await listMovies();
      res.status(200).json({ movies });
      return;
    }

    if (req.method === 'POST') {
      const auth = await resolveAuthenticatedSession(req);
      if (!auth.csrfOk) {
        res.status(403).json({ error: 'Requisição bloqueada por proteção CSRF.' });
        return;
      }
      if (!auth.session) {
        res.status(401).json({ error: 'Faça login para indicar um filme ao catálogo.' });
        return;
      }

      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<
        string,
        unknown
      >;
      const title = sanitizeText(body.title, 100);
      const director = sanitizeText(body.director, 80);
      const synopsis = sanitizeText(body.synopsis, 400);
      const recommendationNote = sanitizeText(body.recommendationNote, 240);
      const genre = body.genre as MovieGenre;
      const year = Number(body.year);
      const durationMinutes = Number(body.durationMinutes);
      const rating = Number(body.rating);
      const safePoster = sanitizePosterUrl(body.posterUrl);
      const recommendedBy = auth.session.user.name;
      const clientId = auth.session.user.userKey;

      if (title.length < 2 || director.length < 2 || synopsis.length < 10) {
        res.status(400).json({ error: 'Preencha título, direção e sinopse do filme.' });
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
    const auth = await resolveAuthenticatedSession(req);
    if (!auth.csrfOk) {
      res.status(403).json({ error: 'Requisição bloqueada por proteção CSRF.' });
      return;
    }
    if (!auth.session) {
      res.status(401).json({ error: 'Faça login para avaliar este filme.' });
      return;
    }

    const rawId = req.params?.id ?? req.query?.id;
    const movieId = sanitizeText(Array.isArray(rawId) ? rawId[0] : rawId, 64);
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<
      string,
      unknown
    >;
    const clientId = auth.session.user.userKey;
    const choice = body.choice === 'dislike' ? 'dislike' : 'like';

    if (!movieId) {
      res.status(400).json({ error: 'Identificador do filme é obrigatório.' });
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
      const auth = await resolveAuthenticatedSession(req);
      if (!auth.csrfOk) {
        res.status(403).json({ error: 'Requisição bloqueada por proteção CSRF.' });
        return;
      }
      if (!auth.session) {
        res.status(401).json({ error: 'Faça login para enviar mensagens no chat.' });
        return;
      }

      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<
        string,
        unknown
      >;
      const author = auth.session.user.name;
      const text = sanitizeText(body.text, 400);
      const clientMsgId = sanitizeText(body.id, 64);
      const attachedMovieId = sanitizeText(body.attachedMovieId, 64);

      if (text.length < 1) {
        res.status(400).json({ error: 'Escreva uma mensagem antes de enviar.' });
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
