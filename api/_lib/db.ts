import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sql from 'mssql';

export type MovieGenre =
  | 'Romance'
  | 'Animação'
  | 'Ação'
  | 'Musical'
  | 'Comédia';

export type EvaluationChoice = 'like' | 'dislike';

export type ThemePaletteId = 'cinabrio' | 'cobalto' | 'esmeralda' | 'noturno';

export const VALID_PALETTES: ThemePaletteId[] = [
  'cinabrio',
  'cobalto',
  'esmeralda',
  'noturno',
];

export interface MovieRecord {
  id: string;
  title: string;
  director: string;
  year: number;
  durationMinutes: number;
  genre: MovieGenre;
  synopsis: string;
  recommendedBy: string;
  recommendationNote: string;
  posterUrl: string;
  rating: number;
  authorRating?: number;
  likedBy: string[];
  dislikedBy: string[];
  createdAt: number;
}

export interface ChatMessageRecord {
  id: string;
  author: string;
  text: string;
  attachedMovieId?: string;
  createdAt: number;
}

export interface AuthUserRecord {
  id: string;
  userKey: string;
  name: string;
  email: string;
  createdAt: number;
}

export interface UserActivityRecord {
  watchlistIds: string[];
  personalRatings: Record<string, number>;
  palette: ThemePaletteId;
}

interface LocalUserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  palette: ThemePaletteId;
  createdAt: number;
}

interface LocalSessionRecord {
  tokenHash: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
}

interface LocalDatabaseSchema {
  movies: MovieRecord[];
  messages: ChatMessageRecord[];
  users: LocalUserRecord[];
  sessions: LocalSessionRecord[];
  watchlists: Record<string, string[]>;
  personalRatings: Record<string, Record<string, number>>;
}

export const VALID_GENRES: MovieGenre[] = [
  'Romance',
  'Animação',
  'Ação',
  'Musical',
  'Comédia',
];

const ALLOWED_POSTERS = new Set<string>([
  '/assets/aistudio/filme1_a0effce9.jpg',
  '/assets/aistudio/filme2_ba15de3e.jpg',
  '/assets/aistudio/filme3_f5e4cc7c.jpg',
  '/assets/aistudio/filme4_7f9fb5f4.jpg',
  '/assets/aistudio/filme8_195fa374.jpg',
  '/assets/aistudio/filme6_6b1c72a1.jpg',
]);

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 dias

export function sanitizeText(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').slice(0, maxLen);
}

export function sanitizeEmail(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase().slice(0, 120);
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 120;
}

export function sanitizePalette(value: unknown): ThemePaletteId {
  return VALID_PALETTES.includes(value as ThemePaletteId)
    ? (value as ThemePaletteId)
    : 'cinabrio';
}

export function sanitizePosterUrl(value: unknown): string {
  const fallback = '/assets/aistudio/filme1_a0effce9.jpg';
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  if (ALLOWED_POSTERS.has(trimmed)) return trimmed;

  // Aceita imagem enviada do computador em Data URL (redimensionada no navegador)
  if (/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    if (trimmed.length <= 300_000) {
      return trimmed;
    }
    return fallback;
  }

  const shortUrl = trimmed.slice(0, 500);
  try {
    const parsed = new URL(shortUrl);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    return fallback;
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Criptografia de senha (scrypt) e hash de token de sessão (SHA-256)
// ---------------------------------------------------------------------------

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;

  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function hashSessionToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function isSqlServerConfigured(): boolean {
  if (process.env.SQLSERVER_CONNECTION_STRING?.trim()) return true;
  return Boolean(
    process.env.SQLSERVER_SERVER?.trim() &&
      process.env.SQLSERVER_DATABASE?.trim() &&
      process.env.SQLSERVER_USER?.trim() &&
      process.env.SQLSERVER_PASSWORD
  );
}

function parseSqlServerConfig(): {
  server: string;
  database: string;
  user: string;
  password: string;
  port: number;
  encrypt: boolean;
} {
  let rawServer = (process.env.SQLSERVER_SERVER || '').trim();
  rawServer = rawServer.replace(/^tcp:/i, '').replace(/^https?:\/\//i, '');

  let parsedPort = Number((process.env.SQLSERVER_PORT || '').trim()) || 1433;

  // Suporta formato "servidor.mssql.somee.com,1433" ou "servidor:1433"
  const commaMatch = rawServer.match(/^([^,]+),(\d+)$/);
  if (commaMatch) {
    rawServer = commaMatch[1].trim();
    parsedPort = Number(commaMatch[2]) || parsedPort;
  } else {
    const colonMatch = rawServer.match(/^([^:]+):(\d+)$/);
    if (colonMatch) {
      rawServer = colonMatch[1].trim();
      parsedPort = Number(colonMatch[2]) || parsedPort;
    }
  }

  return {
    server: rawServer,
    database: (process.env.SQLSERVER_DATABASE || '').trim(),
    user: (process.env.SQLSERVER_USER || '').trim(),
    password: process.env.SQLSERVER_PASSWORD || '',
    port: parsedPort,
    encrypt: (process.env.SQLSERVER_ENCRYPT || '').trim().toLowerCase() === 'true',
  };
}

let sqlPoolPromise: Promise<sql.ConnectionPool> | null = null;
let posterColumnEnsured = false;
let authSchemaEnsured = false;

async function ensurePosterColumnMax(pool: sql.ConnectionPool): Promise<void> {
  if (posterColumnEnsured) return;
  try {
    const colRes = await pool
      .request()
      .query<{ ColLen: number | null }>(`SELECT COL_LENGTH('dbo.Filmes', 'PosterUrl') AS ColLen`);
    const colLen = colRes.recordset[0]?.ColLen;
    if (colLen !== null && colLen !== undefined && colLen !== -1) {
      await pool
        .request()
        .query(`ALTER TABLE dbo.Filmes ALTER COLUMN PosterUrl NVARCHAR(MAX) NOT NULL`);
    }
    posterColumnEnsured = true;
  } catch (err) {
    console.warn('[sqlserver] Não foi possível ampliar PosterUrl automaticamente:', err);
  }
}

async function ensureAuthSchema(pool: sql.ConnectionPool): Promise<void> {
  if (authSchemaEnsured) return;
  await pool.request().query(`
    IF OBJECT_ID('dbo.Usuarios', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.Usuarios (
        Id        INT IDENTITY(1,1) NOT NULL,
        Nome      NVARCHAR(40)      NOT NULL,
        Email     NVARCHAR(120)     NOT NULL,
        SenhaHash NVARCHAR(256)     NOT NULL,
        Paleta    NVARCHAR(20)      NOT NULL CONSTRAINT DF_Usuarios_Paleta DEFAULT (N'cinabrio'),
        CriadoEm  DATETIME2(0)      NOT NULL CONSTRAINT DF_Usuarios_CriadoEm DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_Usuarios PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT UQ_Usuarios_Email UNIQUE (Email)
      );
    END;

    IF OBJECT_ID('dbo.SessoesUsuarios', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.SessoesUsuarios (
        Id        INT IDENTITY(1,1) NOT NULL,
        UsuarioId INT               NOT NULL,
        TokenHash NVARCHAR(64)      NOT NULL,
        CriadoEm  DATETIME2(0)      NOT NULL CONSTRAINT DF_Sessoes_CriadoEm DEFAULT (SYSUTCDATETIME()),
        ExpiraEm  DATETIME2(0)      NOT NULL,
        CONSTRAINT PK_SessoesUsuarios PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_Sessoes_Usuarios FOREIGN KEY (UsuarioId)
          REFERENCES dbo.Usuarios (Id) ON DELETE CASCADE,
        CONSTRAINT UQ_Sessoes_TokenHash UNIQUE (TokenHash)
      );
    END;

    IF OBJECT_ID('dbo.ListaPessoal', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.ListaPessoal (
        Id                   INT IDENTITY(1,1) NOT NULL,
        IdentificadorUsuario NVARCHAR(64)      NOT NULL,
        FilmeId              INT               NOT NULL,
        SalvoEm              DATETIME2(0)      NOT NULL CONSTRAINT DF_Lista_SalvoEm DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_ListaPessoal PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_Lista_Filmes FOREIGN KEY (FilmeId)
          REFERENCES dbo.Filmes (Id) ON DELETE CASCADE,
        CONSTRAINT UQ_Lista_Usuario_Filme UNIQUE (IdentificadorUsuario, FilmeId)
      );
    END;

    IF OBJECT_ID('dbo.NotasPessoais', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.NotasPessoais (
        Id                   INT IDENTITY(1,1) NOT NULL,
        IdentificadorUsuario NVARCHAR(64)      NOT NULL,
        FilmeId              INT               NOT NULL,
        Nota                 TINYINT           NOT NULL,
        AtualizadoEm         DATETIME2(0)      NOT NULL CONSTRAINT DF_Notas_AtualizadoEm DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_NotasPessoais PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_Notas_Filmes FOREIGN KEY (FilmeId)
          REFERENCES dbo.Filmes (Id) ON DELETE CASCADE,
        CONSTRAINT CK_Notas_Valor CHECK (Nota BETWEEN 1 AND 5),
        CONSTRAINT UQ_Notas_Usuario_Filme UNIQUE (IdentificadorUsuario, FilmeId)
      );
    END;

    IF COL_LENGTH('dbo.Filmes', 'NotaAutor') IS NULL
    BEGIN
      ALTER TABLE dbo.Filmes ADD NotaAutor DECIMAL(2,1) NULL;
    END;
  `);

  await pool.request().query(`
    UPDATE dbo.Filmes SET NotaAutor = NotaMedia WHERE NotaAutor IS NULL;
  `);

  authSchemaEnsured = true;
}

async function getSqlPool(): Promise<sql.ConnectionPool> {
  if (sqlPoolPromise) {
    const existing = await sqlPoolPromise;
    if (existing.connected) return existing;
    sqlPoolPromise = null;
  }

  const connStr = process.env.SQLSERVER_CONNECTION_STRING?.trim();
  const cfg = parseSqlServerConfig();

  const connectPromise = connStr
    ? new sql.ConnectionPool(connStr).connect()
    : new sql.ConnectionPool({
        server: cfg.server,
        database: cfg.database,
        user: cfg.user,
        password: cfg.password,
        port: cfg.port,
        connectionTimeout: 5500,
        requestTimeout: 5500,
        options: {
          encrypt: cfg.encrypt,
          trustServerCertificate: true,
        },
        pool: {
          max: 5,
          min: 0,
          idleTimeoutMillis: 15000,
        },
      }).connect();

  sqlPoolPromise = connectPromise.catch((err) => {
    sqlPoolPromise = null;
    throw err;
  });

  return sqlPoolPromise;
}

export function getSqlDiagnostics(): {
  configured: boolean;
  server: string;
  database: string;
  port: number;
  encrypt: boolean;
} {
  const cfg = parseSqlServerConfig();
  return {
    configured: isSqlServerConfigured(),
    server: cfg.server || '(não definido)',
    database: cfg.database || '(não definido)',
    port: cfg.port,
    encrypt: cfg.encrypt,
  };
}

// ---------------------------------------------------------------------------
// Armazenamento JSON local para desenvolvimento/preview sem SQL Server
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.VERCEL
  ? '/tmp/cineroda-data'
  : path.resolve(__dirname, '../../data');
const DB_PATH = path.resolve(DATA_DIR, 'cineclube.db.json');

function createSeedDatabase(): LocalDatabaseSchema {
  const now = Date.now();
  return {
    movies: [
      {
        id: 'mov-como-eu-era',
        title: 'Como Eu Era Antes de Você',
        director: 'Thea Sharrock',
        year: 2016,
        durationMinutes: 110,
        genre: 'Romance',
        synopsis:
          'Louisa Clark aceita trabalhar como cuidadora de Will Traynor, um jovem banqueiro tetraplégico que recuperará a vontade de viver ao lado do jeito vibrante dela.',
        recommendedBy: 'Marina Silva',
        recommendationNote:
          'Prepare o lenço! Romance emocionante com química incrível entre os protagonistas.',
        posterUrl: '/assets/aistudio/filme1_a0effce9.jpg',
        rating: 4.8,
        likedBy: ['seed-1', 'seed-2', 'seed-3', 'seed-4'],
        dislikedBy: [],
        createdAt: now - 1000 * 60 * 180,
      },
      {
        id: 'mov-pequeno-principe',
        title: 'O Pequeno Príncipe',
        director: 'Mark Osborne',
        year: 2015,
        durationMinutes: 108,
        genre: 'Animação',
        synopsis:
          'Uma garota metódica conhece o vizinho aviador, que lhe apresenta as aventuras do Pequeno Príncipe e a importância de enxergar com o coração.',
        recommendedBy: 'Lucas Andrade',
        recommendationNote:
          'Animação poética que mistura CGI e stop-motion, perfeita para qualquer idade.',
        posterUrl: '/assets/aistudio/filme2_ba15de3e.jpg',
        rating: 4.9,
        likedBy: ['seed-1', 'seed-2', 'seed-5'],
        dislikedBy: [],
        createdAt: now - 1000 * 60 * 150,
      },
      {
        id: 'mov-homem-aranha',
        title: 'Homem-Aranha: Um Novo Dia',
        director: 'Destin Daniel Cretton',
        year: 2026,
        durationMinutes: 138,
        genre: 'Ação',
        synopsis:
          'Em um recomeço solitário em Nova York, Peter Parker precisa equilibrar a vida anônima de estudante universitário com novas ameaças nas ruas da cidade.',
        recommendedBy: 'Beatriz Costa',
        recommendationNote:
          'Ação eletrizante, clima urbano clássico do herói e ótimo gancho dramático.',
        posterUrl: '/assets/aistudio/filme3_f5e4cc7c.jpg',
        rating: 4.7,
        likedBy: ['seed-2', 'seed-3', 'seed-4'],
        dislikedBy: [],
        createdAt: now - 1000 * 60 * 120,
      },
      {
        id: 'mov-sing',
        title: 'Sing',
        director: 'Garth Jennings',
        year: 2016,
        durationMinutes: 108,
        genre: 'Animação',
        synopsis:
          'Para salvar seu teatro falido, o coala Buster Moon organiza uma grande competição de canto que reúne talentos improváveis da cidade.',
        recommendedBy: 'Sofia Almeida',
        recommendationNote:
          'Divertido do início ao fim e com uma trilha sonora cheia de sucessos.',
        posterUrl: '/assets/aistudio/filme4_7f9fb5f4.jpg',
        rating: 4.6,
        likedBy: ['seed-1', 'seed-3', 'seed-5'],
        dislikedBy: ['seed-6'],
        createdAt: now - 1000 * 60 * 90,
      },
      {
        id: 'mov-wicked',
        title: 'Wicked',
        director: 'Jon M. Chu',
        year: 2024,
        durationMinutes: 160,
        genre: 'Musical',
        synopsis:
          'Antes de Dorothy chegar a Oz, a incompreendida Elphaba e a popular Glinda constroem uma amizade improvável na Universidade de Shiz.',
        recommendedBy: 'Gabriel Rocha',
        recommendationNote:
          'Cenários grandiosos, vocais impressionantes e figurinos impecáveis.',
        posterUrl: '/assets/aistudio/filme8_195fa374.jpg',
        rating: 4.8,
        likedBy: ['seed-1', 'seed-4', 'seed-6'],
        dislikedBy: [],
        createdAt: now - 1000 * 60 * 60,
      },
      {
        id: 'mov-minha-melhor-amiga',
        title: 'Minha Melhor Amiga',
        director: 'Susana Garcia',
        year: 2025,
        durationMinutes: 105,
        genre: 'Comédia',
        synopsis:
          'Duas amigas inseparáveis embarcam em uma viagem cheia de confusões, reencontros e momentos hilários que colocam sua parceria à prova.',
        recommendedBy: 'Rafael Lima',
        recommendationNote:
          'Comédia nacional leve e certeira para dar boas risadas em grupo.',
        posterUrl: '/assets/aistudio/filme6_6b1c72a1.jpg',
        rating: 4.5,
        likedBy: ['seed-2', 'seed-5'],
        dislikedBy: [],
        createdAt: now - 1000 * 60 * 30,
      },
    ],
    messages: [
      {
        id: 'msg-seed-1',
        author: 'Marina Silva',
        text: 'Se você quer um romance para chorar de verdade, assista Como Eu Era Antes de Você!',
        attachedMovieId: 'mov-como-eu-era',
        createdAt: now - 1000 * 60 * 25,
      },
      {
        id: 'msg-seed-2',
        author: 'Gabriel Rocha',
        text: 'Concordo! E quem curte musical não pode deixar de ver Wicked.',
        attachedMovieId: 'mov-wicked',
        createdAt: now - 1000 * 60 * 14,
      },
      {
        id: 'msg-seed-3',
        author: 'Beatriz Costa',
        text: 'Alguém já assistiu Homem-Aranha: Um Novo Dia ou quer indicar outro filme de ação?',
        attachedMovieId: 'mov-homem-aranha',
        createdAt: now - 1000 * 60 * 5,
      },
    ],
    users: [],
    sessions: [],
    watchlists: {},
    personalRatings: {},
  };
}

function loadLocalDb(): LocalDatabaseSchema {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_PATH)) {
      const seed = createSeedDatabase();
      saveLocalDb(seed);
      return seed;
    }
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<LocalDatabaseSchema>;
    if (!Array.isArray(parsed.movies) || !Array.isArray(parsed.messages)) {
      const seed = createSeedDatabase();
      saveLocalDb(seed);
      return seed;
    }
    return {
      movies: parsed.movies.map((m) => ({
        ...m,
        likedBy: Array.isArray(m.likedBy) ? m.likedBy : [],
        dislikedBy: Array.isArray(m.dislikedBy) ? m.dislikedBy : [],
      })),
      messages: parsed.messages,
      users: Array.isArray(parsed.users) ? parsed.users : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      watchlists:
        parsed.watchlists && typeof parsed.watchlists === 'object' ? parsed.watchlists : {},
      personalRatings:
        parsed.personalRatings && typeof parsed.personalRatings === 'object'
          ? parsed.personalRatings
          : {},
    };
  } catch {
    return createSeedDatabase();
  }
}

function saveLocalDb(data: LocalDatabaseSchema): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, DB_PATH);
}

// ---------------------------------------------------------------------------
// Tipos e helpers SQL Server
// ---------------------------------------------------------------------------

interface SqlMovieRow {
  Id: number;
  Titulo: string;
  Diretor: string;
  AnoLancamento: number;
  DuracaoMinutos: number;
  Genero: MovieGenre;
  Sinopse: string;
  IndicadoPor: string;
  MotivoIndicacao: string;
  PosterUrl: string;
  NotaMedia: number;
  NotaAutor?: number | null;
  CriadoEm: Date;
}

interface SqlEvalRow {
  FilmeId: number;
  IdentificadorUsuario: string;
  Gostou: boolean;
}

interface SqlChatRow {
  Id: number;
  Autor: string;
  Texto: string;
  FilmeAnexadoId: number | null;
  CriadoEm: Date;
}

interface SqlUserRow {
  Id: number;
  Nome: string;
  Email: string;
  SenhaHash: string;
  Paleta: string;
  CriadoEm: Date;
}

function mapSqlMovies(movieRows: SqlMovieRow[], evalRows: SqlEvalRow[]): MovieRecord[] {
  const likesMap = new Map<number, string[]>();
  const dislikesMap = new Map<number, string[]>();

  for (const ev of evalRows) {
    if (ev.Gostou) {
      const list = likesMap.get(ev.FilmeId) ?? [];
      list.push(ev.IdentificadorUsuario);
      likesMap.set(ev.FilmeId, list);
    } else {
      const list = dislikesMap.get(ev.FilmeId) ?? [];
      list.push(ev.IdentificadorUsuario);
      dislikesMap.set(ev.FilmeId, list);
    }
  }

  return movieRows.map((row) => ({
    id: String(row.Id),
    title: row.Titulo,
    director: row.Diretor,
    year: row.AnoLancamento,
    durationMinutes: row.DuracaoMinutos,
    genre: row.Genero,
    synopsis: row.Sinopse,
    recommendedBy: row.IndicadoPor,
    recommendationNote: row.MotivoIndicacao,
    posterUrl: row.PosterUrl,
    rating: Number(row.NotaMedia),
    likedBy: likesMap.get(row.Id) ?? [],
    dislikedBy: dislikesMap.get(row.Id) ?? [],
    createdAt: new Date(row.CriadoEm).getTime(),
  }));
}

function toUserKey(userId: string | number): string {
  const str = String(userId);
  return str.startsWith('usr-') ? str : `usr-${str}`;
}

async function loadSqlUserActivity(
  pool: sql.ConnectionPool,
  userKey: string,
  palette: ThemePaletteId
): Promise<UserActivityRecord> {
  const [watchlistRes, ratingsRes] = await Promise.all([
    pool
      .request()
      .input('Usuario', sql.NVarChar(64), userKey)
      .query<{ FilmeId: number }>(`
        SELECT FilmeId
        FROM dbo.ListaPessoal
        WHERE IdentificadorUsuario = @Usuario
        ORDER BY SalvoEm DESC
      `),
    pool
      .request()
      .input('Usuario', sql.NVarChar(64), userKey)
      .query<{ FilmeId: number; Nota: number }>(`
        SELECT FilmeId, Nota
        FROM dbo.NotasPessoais
        WHERE IdentificadorUsuario = @Usuario
      `),
  ]);

  const personalRatings: Record<string, number> = {};
  for (const row of ratingsRes.recordset) {
    personalRatings[String(row.FilmeId)] = Number(row.Nota);
  }

  return {
    watchlistIds: watchlistRes.recordset.map((r) => String(r.FilmeId)),
    personalRatings,
    palette,
  };
}

// ---------------------------------------------------------------------------
// Autenticação e atividade por conta
// ---------------------------------------------------------------------------

export async function registerUserAccount(input: {
  name: string;
  email: string;
  password: string;
  palette: ThemePaletteId;
}): Promise<
  | { ok: true; user: AuthUserRecord; activity: UserActivityRecord; sessionToken: string }
  | { ok: false; code: 'EMAIL_EXISTS' }
> {
  const passwordHash = hashPassword(input.password);
  const rawToken = generateSessionToken();
  const tokenHash = hashSessionToken(rawToken);
  const expiresAtMs = Date.now() + SESSION_TTL_MS;

  if (!isSqlServerConfigured()) {
    const db = loadLocalDb();
    if (db.users.some((u) => u.email.toLowerCase() === input.email)) {
      return { ok: false, code: 'EMAIL_EXISTS' };
    }

    const userId = `usr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newUser: LocalUserRecord = {
      id: userId,
      name: input.name,
      email: input.email,
      passwordHash,
      palette: input.palette,
      createdAt: Date.now(),
    };

    db.users.push(newUser);
    db.sessions = [
      ...db.sessions.filter((s) => s.expiresAt > Date.now()),
      {
        tokenHash,
        userId,
        createdAt: Date.now(),
        expiresAt: expiresAtMs,
      },
    ];
    db.watchlists[userId] = [];
    db.personalRatings[userId] = {};
    saveLocalDb(db);

    return {
      ok: true,
      user: {
        id: userId,
        userKey: userId,
        name: newUser.name,
        email: newUser.email,
        createdAt: newUser.createdAt,
      },
      activity: {
        watchlistIds: [],
        personalRatings: {},
        palette: newUser.palette,
      },
      sessionToken: rawToken,
    };
  }

  const pool = await getSqlPool();
  await ensureAuthSchema(pool);

  const existingRes = await pool
    .request()
    .input('Email', sql.NVarChar(120), input.email)
    .query<{ Id: number }>(`SELECT Id FROM dbo.Usuarios WHERE Email = @Email`);

  if (existingRes.recordset.length > 0) {
    return { ok: false, code: 'EMAIL_EXISTS' };
  }

  const insertUserRes = await pool
    .request()
    .input('Nome', sql.NVarChar(40), input.name)
    .input('Email', sql.NVarChar(120), input.email)
    .input('SenhaHash', sql.NVarChar(256), passwordHash)
    .input('Paleta', sql.NVarChar(20), input.palette)
    .query<SqlUserRow>(`
      INSERT INTO dbo.Usuarios (Nome, Email, SenhaHash, Paleta)
      OUTPUT INSERTED.*
      VALUES (@Nome, @Email, @SenhaHash, @Paleta)
    `);

  const created = insertUserRes.recordset[0];
  const expiresAt = new Date(expiresAtMs);

  await pool
    .request()
    .input('UsuarioId', sql.Int, created.Id)
    .input('TokenHash', sql.NVarChar(64), tokenHash)
    .input('ExpiraEm', sql.DateTime2, expiresAt)
    .query(`
      INSERT INTO dbo.SessoesUsuarios (UsuarioId, TokenHash, ExpiraEm)
      VALUES (@UsuarioId, @TokenHash, @ExpiraEm)
    `);

  return {
    ok: true,
    user: {
      id: String(created.Id),
      userKey: toUserKey(created.Id),
      name: created.Nome,
      email: created.Email,
      createdAt: new Date(created.CriadoEm).getTime(),
    },
    activity: {
      watchlistIds: [],
      personalRatings: {},
      palette: sanitizePalette(created.Paleta),
    },
    sessionToken: rawToken,
  };
}

export async function loginUserAccount(input: {
  email: string;
  password: string;
}): Promise<{
  user: AuthUserRecord;
  activity: UserActivityRecord;
  sessionToken: string;
} | null> {
  const rawToken = generateSessionToken();
  const tokenHash = hashSessionToken(rawToken);
  const expiresAtMs = Date.now() + SESSION_TTL_MS;

  if (!isSqlServerConfigured()) {
    const db = loadLocalDb();
    const user = db.users.find((u) => u.email.toLowerCase() === input.email);
    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      return null;
    }

    db.sessions = [
      ...db.sessions.filter((s) => s.expiresAt > Date.now()),
      {
        tokenHash,
        userId: user.id,
        createdAt: Date.now(),
        expiresAt: expiresAtMs,
      },
    ].slice(-200);
    saveLocalDb(db);

    return {
      user: {
        id: user.id,
        userKey: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
      activity: {
        watchlistIds: db.watchlists[user.id] ?? [],
        personalRatings: db.personalRatings[user.id] ?? {},
        palette: sanitizePalette(user.palette),
      },
      sessionToken: rawToken,
    };
  }

  const pool = await getSqlPool();
  await ensureAuthSchema(pool);

  const userRes = await pool
    .request()
    .input('Email', sql.NVarChar(120), input.email)
    .query<SqlUserRow>(`
      SELECT Id, Nome, Email, SenhaHash, Paleta, CriadoEm
      FROM dbo.Usuarios
      WHERE Email = @Email
    `);

  const row = userRes.recordset[0];
  if (!row || !verifyPassword(input.password, row.SenhaHash)) {
    return null;
  }

  const expiresAt = new Date(expiresAtMs);
  await pool
    .request()
    .input('UsuarioId', sql.Int, row.Id)
    .input('TokenHash', sql.NVarChar(64), tokenHash)
    .input('ExpiraEm', sql.DateTime2, expiresAt)
    .query(`
      DELETE FROM dbo.SessoesUsuarios WHERE ExpiraEm <= SYSUTCDATETIME();
      INSERT INTO dbo.SessoesUsuarios (UsuarioId, TokenHash, ExpiraEm)
      VALUES (@UsuarioId, @TokenHash, @ExpiraEm);
    `);

  const userKey = toUserKey(row.Id);
  const activity = await loadSqlUserActivity(pool, userKey, sanitizePalette(row.Paleta));

  return {
    user: {
      id: String(row.Id),
      userKey,
      name: row.Nome,
      email: row.Email,
      createdAt: new Date(row.CriadoEm).getTime(),
    },
    activity,
    sessionToken: rawToken,
  };
}

export async function getSessionUser(rawToken: string): Promise<{
  user: AuthUserRecord;
  activity: UserActivityRecord;
} | null> {
  if (!rawToken) return null;
  const tokenHash = hashSessionToken(rawToken);

  if (!isSqlServerConfigured()) {
    const db = loadLocalDb();
    const now = Date.now();
    const session = db.sessions.find(
      (s) => s.tokenHash === tokenHash && s.expiresAt > now
    );
    if (!session) return null;

    const user = db.users.find((u) => u.id === session.userId);
    if (!user) return null;

    return {
      user: {
        id: user.id,
        userKey: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
      activity: {
        watchlistIds: db.watchlists[user.id] ?? [],
        personalRatings: db.personalRatings[user.id] ?? {},
        palette: sanitizePalette(user.palette),
      },
    };
  }

  const pool = await getSqlPool();
  await ensureAuthSchema(pool);

  const res = await pool
    .request()
    .input('TokenHash', sql.NVarChar(64), tokenHash)
    .query<SqlUserRow>(`
      SELECT u.Id, u.Nome, u.Email, u.SenhaHash, u.Paleta, u.CriadoEm
      FROM dbo.SessoesUsuarios s
      INNER JOIN dbo.Usuarios u ON u.Id = s.UsuarioId
      WHERE s.TokenHash = @TokenHash AND s.ExpiraEm > SYSUTCDATETIME()
    `);

  const row = res.recordset[0];
  if (!row) return null;

  const userKey = toUserKey(row.Id);
  const activity = await loadSqlUserActivity(pool, userKey, sanitizePalette(row.Paleta));

  return {
    user: {
      id: String(row.Id),
      userKey,
      name: row.Nome,
      email: row.Email,
      createdAt: new Date(row.CriadoEm).getTime(),
    },
    activity,
  };
}

export async function logoutSession(rawToken: string): Promise<void> {
  if (!rawToken) return;
  const tokenHash = hashSessionToken(rawToken);

  if (!isSqlServerConfigured()) {
    const db = loadLocalDb();
    const nextSessions = db.sessions.filter((s) => s.tokenHash !== tokenHash);
    if (nextSessions.length !== db.sessions.length) {
      db.sessions = nextSessions;
      saveLocalDb(db);
    }
    return;
  }

  const pool = await getSqlPool();
  await ensureAuthSchema(pool);
  await pool
    .request()
    .input('TokenHash', sql.NVarChar(64), tokenHash)
    .query(`DELETE FROM dbo.SessoesUsuarios WHERE TokenHash = @TokenHash`);
}

export async function toggleUserWatchlist(
  userKey: string,
  movieId: string
): Promise<string[] | null> {
  if (!isSqlServerConfigured()) {
    const db = loadLocalDb();
    if (!db.movies.some((m) => m.id === movieId)) return null;
    const current = db.watchlists[userKey] ?? [];
    const exists = current.includes(movieId);
    const next = exists ? current.filter((id) => id !== movieId) : [movieId, ...current];
    db.watchlists[userKey] = next;
    saveLocalDb(db);
    return next;
  }

  const numericMovieId = Number(movieId);
  if (!Number.isInteger(numericMovieId) || numericMovieId <= 0) return null;

  const pool = await getSqlPool();
  await ensureAuthSchema(pool);

  const movieCheck = await pool
    .request()
    .input('FilmeId', sql.Int, numericMovieId)
    .query<{ Id: number }>(`SELECT Id FROM dbo.Filmes WHERE Id = @FilmeId`);
  if (!movieCheck.recordset[0]) return null;

  const existing = await pool
    .request()
    .input('Usuario', sql.NVarChar(64), userKey)
    .input('FilmeId', sql.Int, numericMovieId)
    .query<{ Id: number }>(`
      SELECT Id FROM dbo.ListaPessoal
      WHERE IdentificadorUsuario = @Usuario AND FilmeId = @FilmeId
    `);

  if (existing.recordset[0]) {
    await pool
      .request()
      .input('Usuario', sql.NVarChar(64), userKey)
      .input('FilmeId', sql.Int, numericMovieId)
      .query(`
        DELETE FROM dbo.ListaPessoal
        WHERE IdentificadorUsuario = @Usuario AND FilmeId = @FilmeId
      `);
  } else {
    await pool
      .request()
      .input('Usuario', sql.NVarChar(64), userKey)
      .input('FilmeId', sql.Int, numericMovieId)
      .query(`
        INSERT INTO dbo.ListaPessoal (IdentificadorUsuario, FilmeId)
        VALUES (@Usuario, @FilmeId)
      `);
  }

  const listRes = await pool
    .request()
    .input('Usuario', sql.NVarChar(64), userKey)
    .query<{ FilmeId: number }>(`
      SELECT FilmeId FROM dbo.ListaPessoal
      WHERE IdentificadorUsuario = @Usuario
      ORDER BY SalvoEm DESC
    `);

  return listRes.recordset.map((r) => String(r.FilmeId));
}

export async function saveUserMovieRating(
  userKey: string,
  movieId: string,
  rating: number
): Promise<{ personalRatings: Record<string, number>; movie: MovieRecord } | null> {
  const safeRating = Math.round(rating);
  if (!Number.isInteger(safeRating) || safeRating < 1 || safeRating > 5) return null;

  if (!isSqlServerConfigured()) {
    const db = loadLocalDb();
    const movieIndex = db.movies.findIndex((m) => m.id === movieId);
    if (movieIndex === -1) return null;

    const current = db.personalRatings[userKey] ?? {};
    const nextRatings = { ...current, [movieId]: safeRating };
    db.personalRatings[userKey] = nextRatings;

    const targetMovie = db.movies[movieIndex];
    const baseAuthorRating = targetMovie.authorRating ?? targetMovie.rating;
    const allUserRatings = Object.values(db.personalRatings)
      .map((map) => map[movieId])
      .filter((val): val is number => typeof val === 'number' && val >= 1 && val <= 5);

    const totalSum =
      baseAuthorRating + allUserRatings.reduce((acc, item) => acc + item, 0);
    const updatedAverage = Math.round((totalSum / (1 + allUserRatings.length)) * 10) / 10;

    const updatedMovie: MovieRecord = {
      ...targetMovie,
      authorRating: baseAuthorRating,
      rating: updatedAverage,
    };
    db.movies[movieIndex] = updatedMovie;

    saveLocalDb(db);
    return { personalRatings: nextRatings, movie: updatedMovie };
  }

  const numericMovieId = Number(movieId);
  if (!Number.isInteger(numericMovieId) || numericMovieId <= 0) return null;

  const pool = await getSqlPool();
  await ensureAuthSchema(pool);

  const movieRes = await pool
    .request()
    .input('FilmeId', sql.Int, numericMovieId)
    .query<SqlMovieRow>(`SELECT * FROM dbo.Filmes WHERE Id = @FilmeId`);
  const targetMovie = movieRes.recordset[0];
  if (!targetMovie) return null;

  const existing = await pool
    .request()
    .input('Usuario', sql.NVarChar(64), userKey)
    .input('FilmeId', sql.Int, numericMovieId)
    .query<{ Id: number }>(`
      SELECT Id FROM dbo.NotasPessoais
      WHERE IdentificadorUsuario = @Usuario AND FilmeId = @FilmeId
    `);

  if (existing.recordset[0]) {
    await pool
      .request()
      .input('Usuario', sql.NVarChar(64), userKey)
      .input('FilmeId', sql.Int, numericMovieId)
      .input('Nota', sql.TinyInt, safeRating)
      .query(`
        UPDATE dbo.NotasPessoais
        SET Nota = @Nota, AtualizadoEm = SYSUTCDATETIME()
        WHERE IdentificadorUsuario = @Usuario AND FilmeId = @FilmeId
      `);
  } else {
    await pool
      .request()
      .input('Usuario', sql.NVarChar(64), userKey)
      .input('FilmeId', sql.Int, numericMovieId)
      .input('Nota', sql.TinyInt, safeRating)
      .query(`
        INSERT INTO dbo.NotasPessoais (IdentificadorUsuario, FilmeId, Nota)
        VALUES (@Usuario, @FilmeId, @Nota)
      `);
  }

  const [movieNotesRes, userNotesRes, evalsRes] = await Promise.all([
    pool
      .request()
      .input('FilmeId', sql.Int, numericMovieId)
      .query<{ Nota: number }>(`
        SELECT Nota FROM dbo.NotasPessoais WHERE FilmeId = @FilmeId
      `),
    pool
      .request()
      .input('Usuario', sql.NVarChar(64), userKey)
      .query<{ FilmeId: number; Nota: number }>(`
        SELECT FilmeId, Nota FROM dbo.NotasPessoais
        WHERE IdentificadorUsuario = @Usuario
      `),
    pool
      .request()
      .input('FilmeId', sql.Int, numericMovieId)
      .query<SqlEvalRow>(`
        SELECT FilmeId, IdentificadorUsuario, Gostou
        FROM dbo.AvaliacoesFilmes
        WHERE FilmeId = @FilmeId
      `),
  ]);

  const baseAuthorRating = Number(targetMovie.NotaAutor ?? targetMovie.NotaMedia);
  const allUserNotes = movieNotesRes.recordset.map((r) => Number(r.Nota));
  const totalSum =
    baseAuthorRating + allUserNotes.reduce((acc, item) => acc + item, 0);
  const updatedAverage = Math.round((totalSum / (1 + allUserNotes.length)) * 10) / 10;

  const updatedMovieRes = await pool
    .request()
    .input('FilmeId', sql.Int, numericMovieId)
    .input('NotaMedia', sql.Decimal(2, 1), updatedAverage)
    .input('NotaAutor', sql.Decimal(2, 1), baseAuthorRating)
    .query<SqlMovieRow>(`
      UPDATE dbo.Filmes
      SET NotaMedia = @NotaMedia,
          NotaAutor = COALESCE(NotaAutor, @NotaAutor)
      OUTPUT INSERTED.*
      WHERE Id = @FilmeId
    `);

  const nextRatings: Record<string, number> = {};
  for (const r of userNotesRes.recordset) {
    nextRatings[String(r.FilmeId)] = Number(r.Nota);
  }

  const updatedMovie = mapSqlMovies(
    [updatedMovieRes.recordset[0] ?? targetMovie],
    evalsRes.recordset
  )[0];

  return { personalRatings: nextRatings, movie: updatedMovie };
}

export async function updateUserPalette(
  userId: string,
  palette: ThemePaletteId
): Promise<ThemePaletteId> {
  const safePalette = sanitizePalette(palette);

  if (!isSqlServerConfigured()) {
    const db = loadLocalDb();
    const target = db.users.find((u) => u.id === userId);
    if (target) {
      target.palette = safePalette;
      saveLocalDb(db);
    }
    return safePalette;
  }

  const numericId = Number(userId);
  if (!Number.isInteger(numericId) || numericId <= 0) return safePalette;

  const pool = await getSqlPool();
  await ensureAuthSchema(pool);
  await pool
    .request()
    .input('Id', sql.Int, numericId)
    .input('Paleta', sql.NVarChar(20), safePalette)
    .query(`UPDATE dbo.Usuarios SET Paleta = @Paleta WHERE Id = @Id`);

  return safePalette;
}

// ---------------------------------------------------------------------------
// Catálogo, Avaliações e Chat (SQL Server quando configurado, JSON local caso contrário)
// ---------------------------------------------------------------------------

export async function getHealthStatus(): Promise<{
  ok: boolean;
  driver: 'sqlserver' | 'local-json';
  moviesCount: number;
  messagesCount: number;
}> {
  if (!isSqlServerConfigured()) {
    const db = loadLocalDb();
    return {
      ok: true,
      driver: 'local-json',
      moviesCount: db.movies.length,
      messagesCount: db.messages.length,
    };
  }

  const pool = await getSqlPool();
  const result = await pool.request().query<{ moviesCount: number; messagesCount: number }>(`
    SELECT
      (SELECT COUNT(*) FROM dbo.Filmes) AS moviesCount,
      (SELECT COUNT(*) FROM dbo.MensagensChat) AS messagesCount
  `);
  const row = result.recordset[0];
  return {
    ok: true,
    driver: 'sqlserver',
    moviesCount: row?.moviesCount ?? 0,
    messagesCount: row?.messagesCount ?? 0,
  };
}

export async function listMovies(): Promise<MovieRecord[]> {
  if (!isSqlServerConfigured()) {
    return loadLocalDb().movies;
  }

  const pool = await getSqlPool();
  const [moviesRes, evalsRes] = await Promise.all([
    pool.request().query<SqlMovieRow>(`
      SELECT Id, Titulo, Diretor, AnoLancamento, DuracaoMinutos, Genero,
             Sinopse, IndicadoPor, MotivoIndicacao, PosterUrl, NotaMedia, CriadoEm
      FROM dbo.Filmes
      ORDER BY CriadoEm DESC, Id DESC
    `),
    pool.request().query<SqlEvalRow>(`
      SELECT FilmeId, IdentificadorUsuario, Gostou
      FROM dbo.AvaliacoesFilmes
    `),
  ]);

  return mapSqlMovies(moviesRes.recordset, evalsRes.recordset);
}

export interface CreateMovieInput {
  title: string;
  director: string;
  year: number;
  durationMinutes: number;
  genre: MovieGenre;
  synopsis: string;
  recommendedBy: string;
  recommendationNote: string;
  posterUrl: string;
  rating: number;
  clientId: string;
}

export async function createMovie(input: CreateMovieInput): Promise<MovieRecord> {
  if (!isSqlServerConfigured()) {
    const db = loadLocalDb();
    const newMovie: MovieRecord = {
      id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: input.title,
      director: input.director,
      year: input.year,
      durationMinutes: input.durationMinutes,
      genre: input.genre,
      synopsis: input.synopsis,
      recommendedBy: input.recommendedBy,
      recommendationNote: input.recommendationNote,
      posterUrl: input.posterUrl,
      rating: input.rating,
      authorRating: input.rating,
      likedBy: [input.clientId],
      dislikedBy: [],
      createdAt: Date.now(),
    };
    db.movies = [newMovie, ...db.movies];
    saveLocalDb(db);
    return newMovie;
  }

  const pool = await getSqlPool();
  await ensureAuthSchema(pool);
  if (input.posterUrl.startsWith('data:image/')) {
    await ensurePosterColumnMax(pool);
  }

  const insertRes = await pool
    .request()
    .input('Titulo', sql.NVarChar(100), input.title)
    .input('Diretor', sql.NVarChar(80), input.director)
    .input('AnoLancamento', sql.Int, input.year)
    .input('DuracaoMinutos', sql.Int, input.durationMinutes)
    .input('Genero', sql.NVarChar(40), input.genre)
    .input('Sinopse', sql.NVarChar(400), input.synopsis)
    .input('IndicadoPor', sql.NVarChar(40), input.recommendedBy)
    .input('MotivoIndicacao', sql.NVarChar(240), input.recommendationNote)
    .input('PosterUrl', sql.NVarChar(sql.MAX), input.posterUrl)
    .input('NotaMedia', sql.Decimal(2, 1), input.rating)
    .query<SqlMovieRow>(`
      INSERT INTO dbo.Filmes (
        Titulo, Diretor, AnoLancamento, DuracaoMinutos, Genero,
        Sinopse, IndicadoPor, MotivoIndicacao, PosterUrl, NotaMedia, NotaAutor
      )
      OUTPUT INSERTED.*
      VALUES (
        @Titulo, @Diretor, @AnoLancamento, @DuracaoMinutos, @Genero,
        @Sinopse, @IndicadoPor, @MotivoIndicacao, @PosterUrl, @NotaMedia, @NotaMedia
      )
    `);

  const created = insertRes.recordset[0];

  await pool
    .request()
    .input('FilmeId', sql.Int, created.Id)
    .input('Usuario', sql.NVarChar(64), input.clientId)
    .input('Gostou', sql.Bit, 1)
    .query(`
      INSERT INTO dbo.AvaliacoesFilmes (FilmeId, IdentificadorUsuario, Gostou)
      VALUES (@FilmeId, @Usuario, @Gostou)
    `);

  return mapSqlMovies([created], [
    { FilmeId: created.Id, IdentificadorUsuario: input.clientId, Gostou: true },
  ])[0];
}

export async function evaluateMovie(
  movieId: string,
  clientId: string,
  choice: EvaluationChoice
): Promise<MovieRecord | null> {
  if (!isSqlServerConfigured()) {
    const db = loadLocalDb();
    const index = db.movies.findIndex((m) => m.id === movieId);
    if (index === -1) return null;

    const movie = db.movies[index];
    const alreadyLiked = movie.likedBy.includes(clientId);
    const alreadyDisliked = movie.dislikedBy.includes(clientId);

    let nextLikedBy = movie.likedBy.filter((id) => id !== clientId);
    let nextDislikedBy = movie.dislikedBy.filter((id) => id !== clientId);

    if (choice === 'like' && !alreadyLiked) {
      nextLikedBy = [...nextLikedBy, clientId];
    } else if (choice === 'dislike' && !alreadyDisliked) {
      nextDislikedBy = [...nextDislikedBy, clientId];
    }

    const updated: MovieRecord = {
      ...movie,
      likedBy: nextLikedBy,
      dislikedBy: nextDislikedBy,
    };
    db.movies[index] = updated;
    saveLocalDb(db);
    return updated;
  }

  const numericId = Number(movieId);
  if (!Number.isInteger(numericId) || numericId <= 0) return null;

  const pool = await getSqlPool();
  const movieRes = await pool
    .request()
    .input('Id', sql.Int, numericId)
    .query<SqlMovieRow>(`SELECT * FROM dbo.Filmes WHERE Id = @Id`);

  const targetMovie = movieRes.recordset[0];
  if (!targetMovie) return null;

  const desiredLike = choice === 'like';
  const existingEvalRes = await pool
    .request()
    .input('FilmeId', sql.Int, numericId)
    .input('Usuario', sql.NVarChar(64), clientId)
    .query<{ Gostou: boolean }>(`
      SELECT Gostou
      FROM dbo.AvaliacoesFilmes
      WHERE FilmeId = @FilmeId AND IdentificadorUsuario = @Usuario
    `);

  const existing = existingEvalRes.recordset[0];
  if (existing && Boolean(existing.Gostou) === desiredLike) {
    await pool
      .request()
      .input('FilmeId', sql.Int, numericId)
      .input('Usuario', sql.NVarChar(64), clientId)
      .query(`
        DELETE FROM dbo.AvaliacoesFilmes
        WHERE FilmeId = @FilmeId AND IdentificadorUsuario = @Usuario
      `);
  } else if (existing) {
    await pool
      .request()
      .input('FilmeId', sql.Int, numericId)
      .input('Usuario', sql.NVarChar(64), clientId)
      .input('Gostou', sql.Bit, desiredLike ? 1 : 0)
      .query(`
        UPDATE dbo.AvaliacoesFilmes
        SET Gostou = @Gostou, AtualizadoEm = SYSUTCDATETIME()
        WHERE FilmeId = @FilmeId AND IdentificadorUsuario = @Usuario
      `);
  } else {
    await pool
      .request()
      .input('FilmeId', sql.Int, numericId)
      .input('Usuario', sql.NVarChar(64), clientId)
      .input('Gostou', sql.Bit, desiredLike ? 1 : 0)
      .query(`
        INSERT INTO dbo.AvaliacoesFilmes (FilmeId, IdentificadorUsuario, Gostou)
        VALUES (@FilmeId, @Usuario, @Gostou)
      `);
  }

  const evalsRes = await pool
    .request()
    .input('FilmeId', sql.Int, numericId)
    .query<SqlEvalRow>(`
      SELECT FilmeId, IdentificadorUsuario, Gostou
      FROM dbo.AvaliacoesFilmes
      WHERE FilmeId = @FilmeId
    `);

  return mapSqlMovies([targetMovie], evalsRes.recordset)[0];
}

export async function listChatMessages(): Promise<ChatMessageRecord[]> {
  if (!isSqlServerConfigured()) {
    return loadLocalDb().messages;
  }

  const pool = await getSqlPool();
  const res = await pool.request().query<SqlChatRow>(`
    SELECT TOP 100 Id, Autor, Texto, FilmeAnexadoId, CriadoEm
    FROM dbo.MensagensChat
    ORDER BY CriadoEm ASC, Id ASC
  `);

  return res.recordset.map((row) => ({
    id: String(row.Id),
    author: row.Autor,
    text: row.Texto,
    attachedMovieId: row.FilmeAnexadoId ? String(row.FilmeAnexadoId) : undefined,
    createdAt: new Date(row.CriadoEm).getTime(),
  }));
}

export async function createChatMessage(input: {
  clientMsgId?: string;
  author: string;
  text: string;
  attachedMovieId?: string;
}): Promise<ChatMessageRecord> {
  if (!isSqlServerConfigured()) {
    const db = loadLocalDb();
    if (input.clientMsgId) {
      const existing = db.messages.find((m) => m.id === input.clientMsgId);
      if (existing) return existing;
    }

    const validMovieId =
      input.attachedMovieId && db.movies.some((m) => m.id === input.attachedMovieId)
        ? input.attachedMovieId
        : undefined;

    const newMsg: ChatMessageRecord = {
      id: input.clientMsgId || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      author: input.author,
      text: input.text,
      attachedMovieId: validMovieId,
      createdAt: Date.now(),
    };

    db.messages = [...db.messages, newMsg].slice(-150);
    saveLocalDb(db);
    return newMsg;
  }

  const pool = await getSqlPool();
  let attachedInt: number | null = null;
  if (input.attachedMovieId) {
    const parsedId = Number(input.attachedMovieId);
    if (Number.isInteger(parsedId) && parsedId > 0) {
      const checkMovie = await pool
        .request()
        .input('Id', sql.Int, parsedId)
        .query<{ Id: number }>(`SELECT Id FROM dbo.Filmes WHERE Id = @Id`);
      if (checkMovie.recordset[0]) {
        attachedInt = parsedId;
      }
    }
  }

  const insertRes = await pool
    .request()
    .input('Autor', sql.NVarChar(40), input.author)
    .input('Texto', sql.NVarChar(400), input.text)
    .input('FilmeAnexadoId', sql.Int, attachedInt)
    .query<SqlChatRow>(`
      INSERT INTO dbo.MensagensChat (Autor, Texto, FilmeAnexadoId)
      OUTPUT INSERTED.*
      VALUES (@Autor, @Texto, @FilmeAnexadoId)
    `);

  const created = insertRes.recordset[0];
  return {
    id: String(created.Id),
    author: created.Autor,
    text: created.Texto,
    attachedMovieId: created.FilmeAnexadoId ? String(created.FilmeAnexadoId) : undefined,
    createdAt: new Date(created.CriadoEm).getTime(),
  };
}
