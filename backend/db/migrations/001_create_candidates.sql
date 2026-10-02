-- Tabela de candidatos.
-- Os limites de tamanho espelham shared/src/candidate.ts (FIELD_LIMITS).
CREATE TABLE dbo.Candidates (
    Id          INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Candidates PRIMARY KEY,
    FullName    NVARCHAR(150)     NOT NULL,
    Email       NVARCHAR(254)     NOT NULL,
    Phone       NVARCHAR(30)      NULL,
    DesiredRole NVARCHAR(120)     NULL,
    Summary     NVARCHAR(2000)    NULL,
    Source      VARCHAR(10)       NOT NULL
        CONSTRAINT CK_Candidates_Source CHECK (Source IN ('manual', 'pdf')),
    CreatedAt   DATETIME2(0)      NOT NULL
        CONSTRAINT DF_Candidates_CreatedAt DEFAULT SYSUTCDATETIME()
);
GO

-- Um e-mail identifica um candidato: evita cadastros duplicados.
CREATE UNIQUE INDEX UX_Candidates_Email ON dbo.Candidates (Email);
GO

-- Listagem ordenada pelos cadastros mais recentes.
CREATE INDEX IX_Candidates_CreatedAt ON dbo.Candidates (CreatedAt DESC);
GO
