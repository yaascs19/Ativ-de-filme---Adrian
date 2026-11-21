import {
  addMovieComment,
  AuthUserRecord,
  ChatReactionKey,
  createChatMessage,
  createMovie,
  deleteChatMessage,
  deleteMovie,
  deleteMovieComment,
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
  toggleChatReaction,
  toggleUserWatchlist,
  updateMovie,
  updateUserPalette,
  updateUserProfile,
  UserActivityRecord,
  VALID_CHAT_REACTIONS,
  VALID_GENRES,
  VALID_PALETTES,
} from './db.js';

const SESSION_COOKIE_NAME = 'cineroda_session';
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

const rateLimitBuckets = new Map<string, number[]>();

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

function getClientIp(req: ApiRequest): string {
  const fwd = getHeader(req, 'x-forwarded-for').split(',')[0]?.trim();
  const real = getHeader(req, 'x-real-ip').trim();
  return fwd || real || 'local';
}

function checkRateLimit(bucketKey: string, maxHits: number, windowMs: number): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  const prev = rateLimitBuckets.get(bucketKey) ?? [];
  const recent = prev.filter((ts) => ts > cutoff);
  if (recent.length >= maxHits) {
    rateLimitBuckets.set(bucketKey, recent);
    return false;
  }
  recent.push(now);
  rateLimitBuckets.set(bucketKey, recent);

  if (rateLimitBuckets.size > 5000) {
    for (const [k, list] of rateLimitBuckets.entries()) {
      if (list.every((ts) => ts <= cutoff)) {
        rateLimitBuckets.delete(k);
      }
    }
  }
  return true;
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

function validateMoviePayload(body: Record<string, unknown>):
  | {
      ok: true;
      data: {
        title: string;
        director: string;
        year: number;
        durationMinutes: number;
        genre: MovieGenre;
        synopsis: string;
        recommendationNote: string;
        posterUrl: string;
        rating: number;
      };
    }
  | { ok: false; error: string } {
  const title = sanitizeText(body.title, 100);
  const director = sanitizeText(body.director, 80);
  const synopsis = sanitizeText(body.synopsis, 400);
  const recommendationNote = sanitizeText(body.recommendationNote, 240);
  const genre = body.genre as MovieGenre;
  const year = Number(body.year);
  const durationMinutes = Number(body.durationMinutes);
  const rating = Number(body.rating);
  const safePoster = sanitizePosterUrl(body.posterUrl);

  if (title.length < 2 || director.length < 2 || synopsis.length < 10) {
    return {
      ok: false,
      error: 'Preencha título (mín. 2 caracteres), direção e sinopse (mín. 10 caracteres).',
    };
  }
  if (!VALID_GENRES.includes(genre)) {
    return { ok: false, error: 'Gênero inválido.' };
  }
  if (!Number.isFinite(year) || year < 1900 || year > 2030) {
    return { ok: false, error: 'Informe um ano válido entre 1900 e 2030.' };
  }
  if (!Number.isFinite(durationMinutes) || durationMinutes < 30 || durationMinutes > 400) {
    return { ok: false, error: 'Informe a duração do filme entre 30 e 400 minutos.' };
  }
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: 'Informe uma nota inicial válida entre 1 e 5.' };
  }

  return {
    ok: true,
    data: {
      title,
      director,
      year: Math.round(year),
      durationMinutes: Math.round(durationMinutes),
      genre,
      synopsis,
      recommendationNote:
        recommendationNote || 'Indicado diretamente pela comunidade CineRoda.',
      posterUrl: safePoster,
      rating: Math.round(rating * 10) / 10,
    },
  };
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
// Endpoints de autenticação e perfil (/api/auth/:action)
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
      const ip = getClientIp(req);
      if (!checkRateLimit(`auth:register:${ip}`, 15, 60_000)) {
        res.status(429).json({
          error: 'Muitas tentativas em sequência. Aguarde alguns segundos e tente novamente.',
        });
        return;
      }

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
      const ip = getClientIp(req);
      if (!checkRateLimit(`auth:login:${ip}`, 15, 60_000)) {
        res.status(429).json({
          error: 'Muitas tentativas de login. Aguarde alguns segundos e tente novamente.',
        });
        return;
      }

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

    if (action === 'profile' && req.method === 'POST') {
      const auth = await resolveAuthenticatedSession(req);
      if (!auth.csrfOk) {
        res.status(403).json({ error: 'Requisição bloqueada por proteção CSRF.' });
        return;
      }
      if (!auth.session) {
        res.status(401).json({ error: 'Faça login para editar seu perfil.' });
        return;
      }
      if (!checkRateLimit(`auth:profile:${auth.session.user.userKey}`, 15, 60_000)) {
        res.status(429).json({ error: 'Muitas alterações seguidas. Aguarde alguns segundos.' });
        return;
      }

      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<
        string,
        unknown
      >;
      const rawName = typeof body.name === 'string' ? sanitizeText(body.name, 40) : undefined;
      const currentPassword =
        typeof body.currentPassword === 'string' ? body.currentPassword : '';
      const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

      if (rawName !== undefined && rawName.length < 2) {
        res.status(400).json({ error: 'O nome deve ter pelo menos 2 caracteres.' });
        return;
      }
      if (newPassword) {
        if (!currentPassword) {
          res.status(400).json({ error: 'Informe sua senha atual para definir uma nova senha.' });
          return;
        }
        if (newPassword.length < 6 || newPassword.length > 100) {
          res.status(400).json({ error: 'A nova senha deve ter entre 6 e 100 caracteres.' });
          return;
        }
      }
      if (rawName === undefined && !newPassword) {
        res.status(400).json({ error: 'Nenhuma alteração informada.' });
        return;
      }

      const updated = await updateUserProfile({
        userId: auth.session.user.id,
        userKey: auth.session.user.userKey,
        name: rawName,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined,
      });

      if (!updated.ok) {
        if (updated.code === 'INVALID_CURRENT_PASSWORD') {
          res.status(400).json({ error: 'A senha atual informada está incorreta.' });
          return;
        }
        res.status(404).json({ error: 'Conta não encontrada.' });
        return;
      }

      res.status(200).json({ user: updated.user });
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
// Endpoint de atividade pessoal e comentários (/api/user/activity)
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
    if (!checkRateLimit(`activity:${auth.session.user.userKey}`, 60, 60_000)) {
      res.status(429).json({
        error: 'Muitas ações em sequência. Aguarde alguns instantes e tente novamente.',
      });
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
      const isClearing = body.rating === null;
      const numericRating = isClearing ? null : Number(body.rating);

      if (
        !movieId ||
        (!isClearing && (!Number.isFinite(numericRating) || numericRating! < 1 || numericRating! > 5))
      ) {
        res.status(400).json({ error: 'Informe uma nota entre 1 e 5.' });
        return;
      }

      const result = await saveUserMovieRating(
        auth.session.user.userKey,
        movieId,
        numericRating
      );
      if (!result.ok) {
        if (result.code === 'AUTHOR_RATING_REQUIRED') {
          res.status(400).json({
            error:
              'Como autor desta indicação, mantenha uma nota de 1 a 5 estrelas (você pode alterá-la quando quiser).',
          });
          return;
        }
        res.status(404).json({ error: 'Filme não encontrado.' });
        return;
      }

      res.status(200).json({
        personalRatings: result.personalRatings,
        movie: result.movie,
      });
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

    if (action === 'addComment') {
      const movieId = sanitizeText(body.movieId, 64);
      const text = sanitizeText(body.text, 240);
      if (!movieId || text.length < 2) {
        res.status(400).json({ error: 'Escreva um comentário com pelo menos 2 caracteres.' });
        return;
      }
      const updatedMovie = await addMovieComment({
        movieId,
        userKey: auth.session.user.userKey,
        author: auth.session.user.name,
        text,
      });
      if (!updatedMovie) {
        res.status(404).json({ error: 'Filme não encontrado.' });
        return;
      }
      res.status(201).json({ movie: updatedMovie });
      return;
    }

    if (action === 'deleteComment') {
      const movieId = sanitizeText(body.movieId, 64);
      const commentId = sanitizeText(body.commentId, 64);
      if (!movieId || !commentId) {
        res.status(400).json({ error: 'Comentário ou filme não informado.' });
        return;
      }
      const updatedMovie = await deleteMovieComment({
        movieId,
        commentId,
        userKey: auth.session.user.userKey,
      });
      if (!updatedMovie) {
        res.status(404).json({ error: 'Filme não encontrado.' });
        return;
      }
      res.status(200).json({ movie: updatedMovie });
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
// Endpoints de filmes, edição, exclusão, avaliações e chat
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
      if (!checkRateLimit(`movies:write:${auth.session.user.userKey}`, 20, 60_000)) {
        res.status(429).json({
          error: 'Muitas indicações seguidas. Aguarde alguns segundos antes de tentar novamente.',
        });
        return;
      }

      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<
        string,
        unknown
      >;
      const validated = validateMoviePayload(body);
      if (!validated.ok) {
        res.status(400).json({ error: validated.error });
        return;
      }

      const result = await createMovie({
        ...validated.data,
        recommendedBy: auth.session.user.name,
        clientId: auth.session.user.userKey,
      });

      if (!result.ok) {
        res.status(409).json({
          error: 'Este filme já está cadastrado no catálogo.',
          existingMovieId: result.existingMovieId,
        });
        return;
      }

      res.status(201).json({ movie: result.movie });
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

export async function handleMovieByIdRequest(req: ApiRequest, res: ApiResponse): Promise<void> {
  try {
    const rawId = req.params?.id ?? req.query?.id;
    const movieId = sanitizeText(Array.isArray(rawId) ? rawId[0] : rawId, 64);
    if (!movieId) {
      res.status(400).json({ error: 'Identificador do filme é obrigatório.' });
      return;
    }

    const auth = await resolveAuthenticatedSession(req);
    if (!auth.csrfOk) {
      res.status(403).json({ error: 'Requisição bloqueada por proteção CSRF.' });
      return;
    }
    if (!auth.session) {
      res.status(401).json({ error: 'Faça login para gerenciar esta indicação.' });
      return;
    }
    if (!checkRateLimit(`movies:write:${auth.session.user.userKey}`, 20, 60_000)) {
      res.status(429).json({ error: 'Muitas ações seguidas. Aguarde alguns segundos.' });
      return;
    }

    if (req.method === 'PATCH') {
      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<
        string,
        unknown
      >;
      const validated = validateMoviePayload(body);
      if (!validated.ok) {
        res.status(400).json({ error: validated.error });
        return;
      }

      const result = await updateMovie(movieId, auth.session.user.userKey, validated.data);
      if (!result.ok) {
        if (result.code === 'NOT_FOUND') {
          res.status(404).json({ error: 'Filme não encontrado.' });
          return;
        }
        if (result.code === 'FORBIDDEN') {
          res.status(403).json({ error: 'Apenas quem indicou este filme pode editá-lo.' });
          return;
        }
        res.status(409).json({
          error: 'Já existe outro filme com esse título no catálogo.',
          existingMovieId: result.existingMovieId,
        });
        return;
      }

      res.status(200).json({ movie: result.movie });
      return;
    }

    if (req.method === 'DELETE') {
      const result = await deleteMovie(movieId, auth.session.user.userKey);
      if (!result.ok) {
        if (result.code === 'NOT_FOUND') {
          res.status(404).json({ error: 'Filme não encontrado.' });
          return;
        }
        res.status(403).json({ error: 'Apenas quem indicou este filme pode excluí-lo.' });
        return;
      }
      res.status(200).json({ ok: true, deletedId: movieId });
      return;
    }

    res.status(405).json({ error: 'Método não permitido.' });
  } catch (err) {
    console.error('[api/movies/:id] Erro:', err);
    res.status(500).json({
      error: 'Erro interno ao atualizar ou remover o filme.',
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
      if (!checkRateLimit(`chat:${auth.session.user.userKey}`, 30, 60_000)) {
        res.status(429).json({ error: 'Muitas mensagens em sequência. Aguarde alguns segundos.' });
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
      const replyToId = sanitizeText(body.replyToId, 64);

      if (text.length < 1) {
        res.status(400).json({ error: 'Escreva uma mensagem antes de enviar.' });
        return;
      }

      const message = await createChatMessage({
        clientMsgId: clientMsgId || undefined,
        userKey: auth.session.user.userKey,
        author,
        text,
        attachedMovieId: attachedMovieId || undefined,
        replyToId: replyToId || undefined,
      });

      res.status(201).json({ message });
      return;
    }

    if (req.method === 'PATCH') {
      const auth = await resolveAuthenticatedSession(req);
      if (!auth.csrfOk) {
        res.status(403).json({ error: 'Requisição bloqueada por proteção CSRF.' });
        return;
      }
      if (!auth.session) {
        res.status(401).json({ error: 'Faça login para reagir às mensagens.' });
        return;
      }
      if (!checkRateLimit(`chat:react:${auth.session.user.userKey}`, 60, 60_000)) {
        res.status(429).json({ error: 'Muitas reações em sequência. Aguarde alguns segundos.' });
        return;
      }

      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<
        string,
        unknown
      >;
      const messageId = sanitizeText(body.messageId, 64);
      const reaction = sanitizeText(body.reaction, 20) as ChatReactionKey;

      if (!messageId || !VALID_CHAT_REACTIONS.includes(reaction)) {
        res.status(400).json({ error: 'Mensagem ou reação inválida.' });
        return;
      }

      const updatedMessage = await toggleChatReaction({
        messageId,
        userKey: auth.session.user.userKey,
        reaction,
      });
      if (!updatedMessage) {
        res.status(404).json({ error: 'Mensagem não encontrada.' });
        return;
      }

      res.status(200).json({ message: updatedMessage });
      return;
    }

    if (req.method === 'DELETE') {
      const auth = await resolveAuthenticatedSession(req);
      if (!auth.csrfOk) {
        res.status(403).json({ error: 'Requisição bloqueada por proteção CSRF.' });
        return;
      }
      if (!auth.session) {
        res.status(401).json({ error: 'Faça login para excluir sua mensagem.' });
        return;
      }
      if (!checkRateLimit(`chat:${auth.session.user.userKey}`, 30, 60_000)) {
        res.status(429).json({ error: 'Muitas ações seguidas. Aguarde alguns segundos.' });
        return;
      }

      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<
        string,
        unknown
      >;
      const rawId = req.query?.id ?? body.id;
      const messageId = sanitizeText(Array.isArray(rawId) ? rawId[0] : rawId, 64);
      if (!messageId) {
        res.status(400).json({ error: 'Identificador da mensagem é obrigatório.' });
        return;
      }

      const deleted = await deleteChatMessage(messageId, auth.session.user.userKey);
      if (!deleted) {
        res.status(404).json({
          error: 'Mensagem não encontrada ou você não tem permissão para excluí-la.',
        });
        return;
      }

      res.status(200).json({ ok: true, deletedId: messageId });
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
