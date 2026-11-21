-- ============================================================================
-- Banco de Dados: CineRoda (Catálogo de Filmes, Avaliações e Chat ao Vivo)
-- Dialeto: Microsoft SQL Server (T-SQL) - compatível com SSMS e Somee
-- ============================================================================

-- Se estiver usando hospedagem gratuita (ex.: Somee), o banco já vem criado.
-- Nesse caso, pule as linhas de CREATE DATABASE / USE e rode a partir das tabelas.
IF DB_ID('CineRodaDB') IS NULL
BEGIN
    CREATE DATABASE CineRodaDB;
END
GO

USE CineRodaDB;
GO

-- ============================================================================
-- 1. TABELAS
-- ============================================================================

IF OBJECT_ID('dbo.ReacoesChat', 'U') IS NOT NULL DROP TABLE dbo.ReacoesChat;
IF OBJECT_ID('dbo.ComentariosFilmes', 'U') IS NOT NULL DROP TABLE dbo.ComentariosFilmes;
IF OBJECT_ID('dbo.SessoesUsuarios', 'U') IS NOT NULL DROP TABLE dbo.SessoesUsuarios;
IF OBJECT_ID('dbo.NotasPessoais', 'U') IS NOT NULL DROP TABLE dbo.NotasPessoais;
IF OBJECT_ID('dbo.ListaPessoal', 'U') IS NOT NULL DROP TABLE dbo.ListaPessoal;
IF OBJECT_ID('dbo.AvaliacoesFilmes', 'U') IS NOT NULL DROP TABLE dbo.AvaliacoesFilmes;
IF OBJECT_ID('dbo.VotosFilmes', 'U') IS NOT NULL DROP TABLE dbo.VotosFilmes;
IF OBJECT_ID('dbo.MensagensChat', 'U') IS NOT NULL DROP TABLE dbo.MensagensChat;
IF OBJECT_ID('dbo.Usuarios', 'U') IS NOT NULL DROP TABLE dbo.Usuarios;
IF OBJECT_ID('dbo.Filmes', 'U') IS NOT NULL DROP TABLE dbo.Filmes;
GO

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
GO

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
GO

CREATE TABLE dbo.Filmes (
    Id                  INT IDENTITY(1,1) NOT NULL,
    Titulo              NVARCHAR(100)     NOT NULL,
    Diretor             NVARCHAR(80)      NOT NULL,
    AnoLancamento       INT               NOT NULL,
    DuracaoMinutos      INT               NOT NULL CONSTRAINT DF_Filmes_Duracao DEFAULT (110),
    Genero              NVARCHAR(40)      NOT NULL,
    Sinopse             NVARCHAR(400)     NOT NULL,
    IndicadoPor         NVARCHAR(40)      NOT NULL,
    CriadoPorUsuarioKey NVARCHAR(64)      NULL,
    MotivoIndicacao     NVARCHAR(240)     NOT NULL,
    PosterUrl           NVARCHAR(MAX)     NOT NULL,
    NotaMedia           DECIMAL(2,1)      NOT NULL CONSTRAINT DF_Filmes_Nota DEFAULT (4.5),
    NotaAutor           DECIMAL(2,1)      NULL,
    CriadoEm            DATETIME2(0)      NOT NULL CONSTRAINT DF_Filmes_CriadoEm DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT PK_Filmes PRIMARY KEY CLUSTERED (Id),
    CONSTRAINT CK_Filmes_Ano CHECK (AnoLancamento BETWEEN 1900 AND 2030),
    CONSTRAINT CK_Filmes_Duracao CHECK (DuracaoMinutos BETWEEN 30 AND 400),
    CONSTRAINT CK_Filmes_Nota CHECK (NotaMedia BETWEEN 1.0 AND 5.0),
    CONSTRAINT CK_Filmes_Genero CHECK (
        Genero IN (
            N'Romance',
            N'Animação',
            N'Ação',
            N'Musical',
            N'Comédia'
        )
    )
);
GO

-- Tabela de avaliações por filme: Gostou (1 = Gostei, 0 = Não gostei) + Nota opcional (1 a 5)
CREATE TABLE dbo.AvaliacoesFilmes (
    Id                   INT IDENTITY(1,1) NOT NULL,
    FilmeId              INT               NOT NULL,
    IdentificadorUsuario NVARCHAR(64)      NOT NULL,
    Gostou               BIT               NOT NULL, -- 1 = Gostei | 0 = Não gostei
    Nota                 TINYINT           NULL,
    Comentario           NVARCHAR(240)     NULL,
    CriadoEm             DATETIME2(0)      NOT NULL CONSTRAINT DF_Aval_CriadoEm DEFAULT (SYSUTCDATETIME()),
    AtualizadoEm         DATETIME2(0)      NOT NULL CONSTRAINT DF_Aval_AtualizadoEm DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT PK_AvaliacoesFilmes PRIMARY KEY CLUSTERED (Id),
    CONSTRAINT FK_Avaliacoes_Filmes FOREIGN KEY (FilmeId)
        REFERENCES dbo.Filmes (Id) ON DELETE CASCADE,
    CONSTRAINT CK_Avaliacoes_Nota CHECK (Nota IS NULL OR Nota BETWEEN 1 AND 5),
    CONSTRAINT UQ_Avaliacoes_Filme_Usuario UNIQUE (FilmeId, IdentificadorUsuario)
);
GO

CREATE TABLE dbo.MensagensChat (
    Id                   INT IDENTITY(1,1) NOT NULL,
    IdentificadorUsuario NVARCHAR(64)      NULL,
    Autor                NVARCHAR(40)      NOT NULL,
    Texto                NVARCHAR(400)     NOT NULL,
    FilmeAnexadoId       INT               NULL,
    RespostaParaId       NVARCHAR(64)      NULL,
    RespostaAutor        NVARCHAR(40)      NULL,
    RespostaTexto        NVARCHAR(120)     NULL,
    CriadoEm             DATETIME2(0)      NOT NULL CONSTRAINT DF_Chat_CriadoEm DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT PK_MensagensChat PRIMARY KEY CLUSTERED (Id),
    CONSTRAINT FK_Chat_Filmes FOREIGN KEY (FilmeAnexadoId)
        REFERENCES dbo.Filmes (Id) ON DELETE SET NULL
);
GO

CREATE TABLE dbo.ReacoesChat (
    Id                   INT IDENTITY(1,1) NOT NULL,
    MensagemId           INT               NOT NULL,
    IdentificadorUsuario NVARCHAR(64)      NOT NULL,
    Reacao               NVARCHAR(20)      NOT NULL,
    CriadoEm             DATETIME2(0)      NOT NULL CONSTRAINT DF_ReacoesChat_CriadoEm DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT PK_ReacoesChat PRIMARY KEY CLUSTERED (Id),
    CONSTRAINT FK_ReacoesChat_Mensagem FOREIGN KEY (MensagemId)
        REFERENCES dbo.MensagensChat (Id) ON DELETE CASCADE,
    CONSTRAINT UQ_ReacoesChat_Usuario_Msg_Tipo UNIQUE (MensagemId, IdentificadorUsuario, Reacao)
);
GO

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
GO

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
GO

CREATE TABLE dbo.ComentariosFilmes (
    Id                   INT IDENTITY(1,1) NOT NULL,
    FilmeId              INT               NOT NULL,
    IdentificadorUsuario NVARCHAR(64)      NOT NULL,
    Autor                NVARCHAR(40)      NOT NULL,
    Texto                NVARCHAR(240)     NOT NULL,
    CriadoEm             DATETIME2(0)      NOT NULL CONSTRAINT DF_Comentarios_CriadoEm DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT PK_ComentariosFilmes PRIMARY KEY CLUSTERED (Id),
    CONSTRAINT FK_Comentarios_Filmes FOREIGN KEY (FilmeId)
        REFERENCES dbo.Filmes (Id) ON DELETE CASCADE
);
GO

CREATE NONCLUSTERED INDEX IX_Filmes_Genero ON dbo.Filmes (Genero);
CREATE NONCLUSTERED INDEX IX_Avaliacoes_FilmeId ON dbo.AvaliacoesFilmes (FilmeId, Gostou);
CREATE NONCLUSTERED INDEX IX_MensagensChat_CriadoEm ON dbo.MensagensChat (CriadoEm DESC);
CREATE NONCLUSTERED INDEX IX_Sessoes_UsuarioId ON dbo.SessoesUsuarios (UsuarioId, ExpiraEm);
GO

-- ============================================================================
-- 2. DADOS INICIAIS (SEED)
-- ============================================================================

INSERT INTO dbo.Filmes (
    Titulo, Diretor, AnoLancamento, DuracaoMinutos, Genero,
    Sinopse, IndicadoPor, MotivoIndicacao, PosterUrl, NotaMedia
)
VALUES
(
    N'Como Eu Era Antes de Você',
    N'Thea Sharrock',
    2016, 110, N'Romance',
    N'Louisa Clark aceita trabalhar como cuidadora de Will Traynor, um jovem banqueiro tetraplégico que recuperará a vontade de viver ao lado do jeito vibrante dela.',
    N'Marina Silva',
    N'Prepare o lenço! Romance emocionante com química incrível entre os protagonistas.',
    N'/assets/aistudio/filme1_a0effce9.jpg',
    4.8
),
(
    N'O Pequeno Príncipe',
    N'Mark Osborne',
    2015, 108, N'Animação',
    N'Uma garota metódica conhece o vizinho aviador, que lhe apresenta as aventuras do Pequeno Príncipe e a importância de enxergar com o coração.',
    N'Lucas Andrade',
    N'Animação poética que mistura CGI e stop-motion, perfeita para qualquer idade.',
    N'/assets/aistudio/filme2_ba15de3e.jpg',
    4.9
),
(
    N'Homem-Aranha: Um Novo Dia',
    N'Destin Daniel Cretton',
    2026, 138, N'Ação',
    N'Em um recomeço solitário em Nova York, Peter Parker precisa equilibrar a vida anônima de estudante universitário com novas ameaças nas ruas da cidade.',
    N'Beatriz Costa',
    N'Ação eletrizante, clima urbano clássico do herói e ótimo gancho dramático.',
    N'/assets/aistudio/filme3_f5e4cc7c.jpg',
    4.7
),
(
    N'Sing',
    N'Garth Jennings',
    2016, 108, N'Animação',
    N'Para salvar seu teatro falido, o coala Buster Moon organiza uma grande competição de canto que reúne talentos improváveis da cidade.',
    N'Sofia Almeida',
    N'Divertido do início ao fim e com uma trilha sonora cheia de sucessos.',
    N'/assets/aistudio/filme4_7f9fb5f4.jpg',
    4.6
),
(
    N'Wicked',
    N'Jon M. Chu',
    2024, 160, N'Musical',
    N'Antes de Dorothy chegar a Oz, a incompreendida Elphaba e a popular Glinda constroem uma amizade improvável na Universidade de Shiz.',
    N'Gabriel Rocha',
    N'Cenários grandiosos, vocais impressionantes e figurinos impecáveis.',
    N'/assets/aistudio/filme8_195fa374.jpg',
    4.8
),
(
    N'Minha Melhor Amiga',
    N'Susana Garcia',
    2025, 105, N'Comédia',
    N'Duas amigas inseparáveis embarcam em uma viagem cheia de confusões, reencontros e momentos hilários que colocam sua parceria à prova.',
    N'Rafael Lima',
    N'Comédia nacional leve e certeira para dar boas risadas em grupo.',
    N'/assets/aistudio/filme6_6b1c72a1.jpg',
    4.5
);
GO

INSERT INTO dbo.AvaliacoesFilmes (FilmeId, IdentificadorUsuario, Gostou, Nota, Comentario)
VALUES
    (1, N'seed-1', 1, 5, N'Muito emocionante!'),
    (1, N'seed-2', 1, 5, N'Um dos melhores romances.'),
    (1, N'seed-3', 1, 4, NULL),
    (2, N'seed-1', 1, 5, N'Lindo visualmente.'),
    (2, N'seed-2', 1, 5, NULL),
    (3, N'seed-2', 1, 5, N'Ótima sequência!'),
    (3, N'seed-3', 1, 4, NULL),
    (4, N'seed-1', 1, 5, N'Músicas muito boas.'),
    (4, N'seed-6', 0, 3, N'Achei o ritmo um pouco corrido.'),
    (5, N'seed-1', 1, 5, N'Vocais absurdos!'),
    (5, N'seed-4', 1, 5, NULL),
    (6, N'seed-2', 1, 4, N'Bem divertido.');
GO

INSERT INTO dbo.MensagensChat (Autor, Texto, FilmeAnexadoId)
VALUES
    (N'Marina Silva', N'Se você quer um romance para chorar de verdade, assista Como Eu Era Antes de Você!', 1),
    (N'Gabriel Rocha', N'Concordo! E quem curte musical não pode deixar de ver Wicked.', 5),
    (N'Beatriz Costa', N'Alguém já assistiu Homem-Aranha: Um Novo Dia ou quer indicar outro filme de ação?', 3);
GO

-- ============================================================================
-- 3. CONSULTAS DE TESTE E OPERAÇÃO
-- ============================================================================

-- Listar filmes com contagem de Gostei, Não gostei, % de aprovação e média das estrelas
SELECT
    f.Id,
    f.Titulo,
    f.Genero,
    f.AnoLancamento,
    SUM(CASE WHEN a.Gostou = 1 THEN 1 ELSE 0 END) AS TotalGostei,
    SUM(CASE WHEN a.Gostou = 0 THEN 1 ELSE 0 END) AS TotalNaoGostei,
    COUNT(a.Id) AS TotalAvaliacoes,
    CAST(
        CASE
            WHEN COUNT(a.Id) = 0 THEN 100.0
            ELSE (SUM(CASE WHEN a.Gostou = 1 THEN 1.0 ELSE 0.0 END) / COUNT(a.Id)) * 100
        END AS DECIMAL(5,1)
    ) AS PercentualAprovacao,
    COALESCE(AVG(CAST(a.Nota AS DECIMAL(3,2))), f.NotaMedia) AS MediaAvaliacao
FROM dbo.Filmes f
LEFT JOIN dbo.AvaliacoesFilmes a ON a.FilmeId = f.Id
GROUP BY f.Id, f.Titulo, f.Genero, f.AnoLancamento, f.NotaMedia, f.CriadoEm
ORDER BY TotalGostei DESC, f.CriadoEm DESC;
GO

-- Exemplo de como registrar ou alterar avaliação (Gostei = 1 / Não gostei = 0)
MERGE dbo.AvaliacoesFilmes AS destino
USING (SELECT 1 AS FilmeId, N'aluno-dsa-01' AS IdentificadorUsuario, 1 AS Gostou, 5 AS Nota) AS origem
ON (destino.FilmeId = origem.FilmeId AND destino.IdentificadorUsuario = origem.IdentificadorUsuario)
WHEN MATCHED THEN
    UPDATE SET
        Gostou = origem.Gostou,
        Nota = origem.Nota,
        AtualizadoEm = SYSUTCDATETIME()
WHEN NOT MATCHED THEN
    INSERT (FilmeId, IdentificadorUsuario, Gostou, Nota)
    VALUES (origem.FilmeId, origem.IdentificadorUsuario, origem.Gostou, origem.Nota);
GO

-- Listar últimas mensagens do chat com o filme anexado
SELECT TOP 50
    m.Id,
    m.Autor,
    m.Texto,
    m.CriadoEm,
    f.Titulo AS FilmeIndicado
FROM dbo.MensagensChat m
LEFT JOIN dbo.Filmes f ON f.Id = m.FilmeAnexadoId
ORDER BY m.CriadoEm ASC;
GO
