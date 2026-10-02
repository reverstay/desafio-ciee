# Cadastro de Currículos

Aplicação para a equipe de recrutamento cadastrar e consultar candidatos, feita para o desafio técnico do CIEE/PR.

O cadastro pode ser feito de duas formas, com **o mesmo formulário e as mesmas regras de validação**:

- **Manual:** a pessoa preenche o formulário e salva, sem enviar documento.
- **Com PDF:** a pessoa envia um currículo (PDF de até 5 MB). O backend extrai o texto e tenta identificar nome, e-mail e telefone. Os dados encontrados preenchem o formulário e podem ser corrigidos ou completados antes de salvar.

Depois de salvo, o candidato aparece na listagem (com busca), que leva à tela de detalhes.

O PDF é opcional: se não for enviado, se for inválido ou se a leitura falhar, o formulário continua disponível para o cadastro manual.

## Tecnologias

| Camada | Tecnologia | Versão |
| --- | --- | --- |
| Frontend | React + TypeScript, Vite, React Router | React 19.3, Vite 8, React Router 7 |
| Backend | Node.js + TypeScript, Express | Node 22 (mínimo 20), Express 5.2, TypeScript 5.9 (executado com tsx) |
| Banco | SQL Server 2022 (Developer) em Docker Compose | `mcr.microsoft.com/mssql/server:2022-latest` |
| Acesso ao banco | `mssql` (driver tedious), SQL parametrizado | 12 |
| Leitura de PDF | `unpdf` (pdf.js) | 1.8 |
| Upload | `multer` (memória, limite de 5 MB) | 2 |
| Validação | `zod`, em um pacote compartilhado pelo frontend e backend | 4 |
| Testes | Vitest, Supertest, Testing Library, jsdom | Vitest 5 |

As versões exatas estão em `package-lock.json`.

## Estrutura

```
.
├── docker-compose.yml        # SQL Server + API + frontend
├── .env.example              # modelo de configuração (sem credenciais reais)
├── shared/                   # regras de validação e tipos usados pelos dois lados
├── backend/
│   ├── Dockerfile
│   ├── db/migrations/        # scripts SQL de criação do banco
│   ├── scripts/migrate.ts    # aplica as migrations
│   ├── scripts/generate-sample-pdf.ts
│   ├── src/
│   │   ├── candidates/       # rotas e repositório (SQL Server)
│   │   └── resumes/          # upload, leitura do PDF e heurísticas de extração
│   └── test/
├── frontend/
│   ├── Dockerfile, nginx.conf
│   └── src/
│       ├── components/       # CandidateForm (formulário único) e PdfImport
│       └── pages/            # listagem, novo candidato e detalhes
└── samples/                  # currículos fictícios para testar a importação
```

## Requisitos

- **Para executar:** apenas Docker com Docker Compose (Docker Desktop no Windows/macOS).
- **Para rodar os testes ou desenvolver:** Node.js 20 ou superior (testado com 22.19) e npm.
- Portas livres: 8080 (frontend), 3333 (API) e 1433 (SQL Server). Podem ser trocadas no `.env`.

## Como executar (Docker Compose)

### 1. Configurar

```bash
cp .env.example .env        # no PowerShell: Copy-Item .env.example .env
```

Edite o `.env` e troque a senha em `MSSQL_SA_PASSWORD` e `DB_PASSWORD` (as duas devem ser iguais). O SQL Server exige pelo menos 8 caracteres com maiúsculas, minúsculas, números e símbolos.

### 2. Subir tudo

```bash
docker compose up -d --build
```

O Compose sobe três serviços:

| Serviço | O que faz |
| --- | --- |
| `sqlserver` | SQL Server 2022, com os dados em um volume Docker |
| `api` | Espera o banco ficar saudável, **aplica as migrations** e inicia a API em http://localhost:3333 |
| `web` | Frontend compilado servido por nginx em http://localhost:8080, que encaminha `/api` para a API |

Abra **http://localhost:8080**. A ordem de inicialização é garantida por healthchecks (banco → API → frontend); na primeira execução o SQL Server leva cerca de 30 s para ficar pronto. Use `docker compose up -d --build --wait` para o comando só terminar quando tudo estiver pronto, ou acompanhe com `docker compose logs -f api` até aparecer `API ouvindo`.

Para parar: `docker compose down` (mantém os dados) ou `docker compose down -v` (apaga o banco).

### 3. Testar a importação

Use os arquivos de [`samples/`](samples/):

| Arquivo | O que testa |
| --- | --- |
| `curriculo-ficticio.pdf` | Currículo completo: nome, e-mail e telefone identificados |
| `curriculo-sem-telefone.pdf` | Nome em maiúsculas e sem telefone: o campo fica para preenchimento manual |
| `arquivo-invalido.pdf` | Arquivo com extensão `.pdf` que não é PDF: mensagem de arquivo inválido |

Os PDFs são gerados por `npm run sample:pdf`.

## Banco de dados

As migrations ficam em [`backend/db/migrations/`](backend/db/migrations/) e são aplicadas por [`backend/scripts/migrate.ts`](backend/scripts/migrate.ts), que:

- cria o banco `DB_NAME` se ele não existir;
- aplica os arquivos `.sql` em ordem, cada um em uma transação;
- registra o que foi aplicado em `dbo.SchemaMigrations`, então pode ser executado de novo sem efeito colateral.

No Docker isso acontece sozinho ao iniciar a API. Fora do Docker: `npm run db:migrate`. Para rodar o SQL à mão, crie o banco `CadastroCurriculos` e execute [`001_create_candidates.sql`](backend/db/migrations/001_create_candidates.sql).

Variáveis de conexão (`.env`):

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `MSSQL_SA_PASSWORD` | — | Senha do `sa` no container do SQL Server |
| `DB_HOST` / `DB_PORT` | `localhost` / `1433` | Endereço do SQL Server (no Compose a API usa `sqlserver`) |
| `DB_USER` / `DB_PASSWORD` | `sa` / — | Credenciais |
| `DB_NAME` | `CadastroCurriculos` | Banco criado pelas migrations |
| `DB_ENCRYPT` | `false` | `true` para servidores que exigem TLS (ex.: Azure SQL) |
| `DB_TRUST_SERVER_CERTIFICATE` | `true` | Aceita o certificado autoassinado do container |
| `PORT` | `3333` | Porta da API quando executada fora do Docker |
| `CORS_ORIGIN` | `http://localhost:5173` | Origem liberada no CORS (modo de desenvolvimento) |
| `WEB_PORT` / `API_PORT` | `8080` / `3333` | Portas publicadas pelo Compose |

## Desenvolvimento local (sem Docker para a aplicação)

Útil para rodar os testes e editar o código com recarga automática. O banco continua no Docker (ou em um SQL Server seu, configurado nas variáveis `DB_*`).

```bash
npm install
docker compose up -d sqlserver
npm run db:migrate
npm run dev          # API em http://localhost:3333 e frontend em http://localhost:5173
```

## Testes

```bash
npm test            # shared + backend + frontend
npm run typecheck   # checagem de tipos dos três pacotes
```

Os testes não precisam do SQL Server: as rotas são testadas com um repositório em memória que implementa a mesma interface do repositório SQL. A leitura de PDF é testada com os arquivos reais de `samples/`.

## API

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/api/health` | Situação da API e do banco |
| `GET` | `/api/candidates?search=` | Lista candidatos (busca por nome, e-mail ou área) |
| `GET` | `/api/candidates/:id` | Detalhes de um candidato |
| `POST` | `/api/candidates` | Cadastra um candidato (JSON) |
| `POST` | `/api/resumes/extract` | Recebe o PDF (`multipart/form-data`, campo `file`) e devolve os dados encontrados. **Não salva nada.** |

Erros seguem o formato `{ "code": "...", "message": "...", "fieldErrors": { "campo": "mensagem" } }`:

| Situação | Status | Código |
| --- | --- | --- |
| Campos inválidos | 400 | `VALIDATION_ERROR` |
| E-mail já cadastrado | 409 | `EMAIL_TAKEN` |
| Nenhum arquivo enviado | 400 | `FILE_REQUIRED` |
| Arquivo maior que 5 MB | 413 | `FILE_TOO_LARGE` |
| Arquivo que não é PDF | 415 | `INVALID_FILE_TYPE` |
| PDF corrompido ou protegido | 422 | `PDF_READ_FAILED` |
| PDF sem texto (imagem digitalizada) | 422 | `PDF_NO_TEXT` |

## Regras de validação

Definidas uma única vez em [`shared/src/candidate.ts`](shared/src/candidate.ts) e usadas pelo formulário e pela API:

- **Nome completo:** obrigatório, até 150 caracteres.
- **E-mail:** obrigatório, formato válido, até 254 caracteres, gravado em minúsculas e único no cadastro.
- **Telefone:** opcional, só números, espaços, `()`, `-`, `.` e `+`, com pelo menos 8 dígitos.
- **Área ou cargo:** opcional, até 120 caracteres.
- **Resumo profissional:** opcional, até 2000 caracteres.
- **PDF:** opcional, até 5 MB, conferido pela assinatura `%PDF-` do arquivo (não só pela extensão).

## Limitações conhecidas

- A extração usa heurísticas, não entende o layout do currículo:
  - **Nome:** procura a linha `Nome: ...`; se não houver, usa a primeira linha do topo com 2 a 6 palavras só com letras. Currículos que começam com um título diferente, ou com o nome em uma única palavra, podem não ser reconhecidos.
  - **E-mail:** primeiro endereço encontrado no texto.
  - **Telefone:** pensado para números brasileiros (com DDD, com ou sem +55). Números sem DDD só são aceitos quando a linha tem rótulo (Tel, Celular, WhatsApp...). Formatos internacionais variados podem não ser reconhecidos.
- PDFs digitalizados (imagem) não têm texto e não passam por OCR: a aplicação avisa e a pessoa preenche manualmente.
- Layouts em colunas podem misturar linhas de colunas diferentes.
- Apenas as 5 primeiras páginas são lidas (os dados de contato costumam estar no início).
- O arquivo PDF não é armazenado: só os dados do formulário são salvos.
- Não há autenticação, edição nem exclusão de candidatos, e a listagem não é paginada.

O relato do desenvolvimento, as decisões técnicas e o uso de IA estão em [DESENVOLVIMENTO.md](DESENVOLVIMENTO.md).
