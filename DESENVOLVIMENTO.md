# Relato do desenvolvimento

> **Ramon:** os trechos marcados com ✏️ dependem de você (tempo gasto, sua revisão, o que mudou depois). Revise o restante para que reflita o que você de fato fez e consegue explicar.

## 1. Como organizei e executei o trabalho

1. **Leitura e recorte do escopo.** Separei o enunciado em requisitos obrigatórios (dois caminhos de cadastro com o mesmo formulário, listagem, detalhes, PDF lido no backend, SQL Server, migrations, validações, mensagens, testes, documentação) e no que ficaria de fora (autenticação, edição, exclusão, paginação, OCR).
2. **Escolha da stack.** React no frontend, Node.js no backend e SQL Server em Docker Compose. Durante o trabalho decidi colocar também a API e o frontend no Compose: quem for avaliar só precisa do Docker, sem instalar Node.
3. **Base compartilhada primeiro.** Comecei pelas regras de validação em um pacote `shared/`, porque o enunciado pede as mesmas regras nos dois caminhos. Frontend e backend importam o mesmo schema.
4. **Backend:** migrations → repositório SQL → rotas de candidatos → upload e leitura do PDF → heurísticas de extração.
5. **Frontend:** formulário único (`CandidateForm`), componente de importação (`PdfImport`), páginas de listagem, cadastro e detalhes.
6. **Testes e verificação** (seção 6), depois **documentação**.
7. Commits pequenos por etapa, para o histórico mostrar a evolução.

## 2. Principais decisões técnicas

| Decisão | Motivo |
| --- | --- |
| **Monorepo com npm workspaces** (`shared`, `backend`, `frontend`) | Um único `npm install` e um único `npm test`. Permite compartilhar o schema de validação sem publicar pacote. |
| **Validação com zod em `shared/`** | Atende "mesmo formulário e mesmas regras": o frontend valida antes de enviar (resposta imediata) e a API valida de novo (nunca confia no cliente), com o mesmo código e as mesmas mensagens. |
| **A extração não salva nada** (`POST /api/resumes/extract` só devolve os dados) | O PDF apenas *preenche* o formulário. O cadastro sempre passa pelo mesmo `POST /api/candidates`, seja manual ou com PDF. Assim, uma falha no PDF nunca bloqueia o cadastro manual. |
| **Express 5** | Simples e conhecido; na versão 5 erros em handlers `async` vão direto para o middleware de erro, sem `try/catch` repetido. |
| **`mssql` com SQL parametrizado, sem ORM** | O domínio é uma tabela. SQL explícito é fácil de ler e de explicar; parâmetros evitam SQL injection. |
| **Migrations em SQL puro + script próprio** | Os scripts ficam legíveis para quem conhece SQL Server, podem ser rodados à mão, e o runner registra o que já foi aplicado (`dbo.SchemaMigrations`), sendo idempotente. |
| **Repositório atrás de uma interface** | As rotas recebem o repositório por injeção (`createApp({ candidates, extractPdfText })`). Nos testes uso uma implementação em memória, então a suíte roda sem banco. |
| **`unpdf` (pdf.js) e reconstrução das linhas pela posição vertical** | O pdf.js devolve fragmentos soltos; agrupar por coordenada Y recupera as linhas, o que é essencial para achar o nome (normalmente a primeira linha). |
| **Heurísticas simples e documentadas** em vez de IA/NLP para extrair os campos | O enunciado aceita extração imperfeita. Regex + regras são previsíveis, testáveis e fáceis de explicar. O que não é encontrado volta `null` e a tela avisa quais campos faltam. |
| **Validação do arquivo pela assinatura `%PDF-`**, além da extensão, e limite de 5 MB no multer | Extensão e `Content-Type` podem ser falsificados. O arquivo fica só em memória e é descartado. |
| **E-mail único** (índice único + checagem na API → HTTP 409) | Evita candidatos duplicados; o índice também cobre gravações simultâneas. |
| **Erros padronizados** `{ code, message, fieldErrors }` | O frontend mostra a mensagem geral e marca cada campo com problema. |
| **Proxy do Vite para `/api`** | Em desenvolvimento não há configuração de URL nem problemas de CORS. |
| **Aplicação completa no Docker Compose**, com healthchecks encadeados (banco → API → frontend) e migrations aplicadas na inicialização da API | `docker compose up` é o único comando para avaliar. Os healthchecks evitam que o frontend receba requisições antes de a API terminar as migrations. |
| **nginx servindo o build do React** e encaminhando `/api` | Frontend e API na mesma origem (sem CORS em produção); `try_files` faz as rotas do React Router funcionarem ao recarregar a página. |

## 3. Ferramentas de IA utilizadas

- **Claude Code** (extensão do VS Code), modelo **Claude Opus 5.5** (Anthropic).
- ✏️ *Se usou outra ferramenta (ChatGPT, Copilot etc.), registre aqui.*

## 4. Onde a IA ajudou (com exemplos de pedidos)

| Etapa | Pedido (resumo) | Como a resposta foi aproveitada |
| --- | --- | --- |
| Planejamento | Colei o enunciado e pedi para "verificar o que é necessário". | Virou o checklist de requisitos e entregáveis e a proposta de stack. Escolhi Node + React no lugar da sugestão inicial (.NET). |
| Implementação | "Faça em Node e React, SQL Server com Docker Compose." | A IA gerou a estrutura do monorepo, as migrations, a API, as telas e os testes. |
| Execução | "Pra que instalar se pode rodar a imagem do Docker?" | Questionei a necessidade de instalar dependências localmente. A resposta separou os dois usos (npm para desenvolver e testar; Docker para executar), e daí veio a decisão de colocar API e frontend no Compose. |
| Extração do PDF | Heurísticas para nome, e-mail e telefone brasileiros. | Usadas com regras para não confundir CPF, datas e períodos ("2019 - 2021") com telefone, cobertas por testes. |
| Dados de teste | Currículos fictícios em PDF. | Script `backend/scripts/generate-sample-pdf.ts` gera os PDFs de `samples/`, inclusive um arquivo inválido. |
| Documentação | README e este relato. | Rascunho gerado pela IA e revisado por mim. ✏️ |

## 5. O que precisei corrigir, adaptar ou descartar

- **Stack:** a primeira sugestão foi ASP.NET Core; troquei por Node.js.
- **Execução só com SQL Server no Compose:** a versão inicial exigia Node instalado para rodar a aplicação. Pedi para a aplicação inteira rodar em Docker.
- **Leitura do PDF quebrada na primeira versão:** o código gerado chamava `pdf.destroy()`, que não existe na versão do pdf.js usada pelo `unpdf` 1.8. Os testes com os PDFs reais de `samples/` acusaram o erro (a API devolvia 422 para um PDF válido); a correção foi encerrar o documento por `pdf.loadingTask.destroy()`.
- **Frontend recebendo 502 logo após subir:** o nginx aceitava requisições enquanto a API ainda aplicava as migrations. Adicionei healthcheck na API, fiz o frontend depender dela e o nginx passou a resolver o nome `api` a cada requisição. O frontend também ganhou uma mensagem própria para servidor indisponível, em vez de "Erro inesperado (HTTP 502)".
- **Layout:** os prints mostraram palavras partidas no meio na tabela ("Manua-l") e a página mais larga que a tela em telas estreitas; ajustei as regras de quebra de texto e a versão em cartões da tabela.
- **Ambiente:** a rede instável derrubava downloads do npm e da imagem do SQL Server. A imagem foi obtida exportando-a com `regctl` dentro de um container e carregando com `docker load`. Isso não afeta quem for executar o projeto em uma rede normal.
- ✏️ *Registre aqui o que você mudou ao revisar o código (ex.: mensagens, nomes, regras de validação, layout) e o que descartou.*

## 6. Como verifiquei a solução

- **Testes automatizados** (`npm test`):
  - `shared`: regras de validação (obrigatórios, formato do e-mail, telefone, limites, normalização).
  - `backend`: rotas de candidatos (criação, validação, e-mail duplicado, JSON malformado, listagem, busca, detalhes, 404/400) e de importação (PDFs reais de `samples/`, arquivo ausente, arquivo falso, arquivo maior que 5 MB, PDF corrompido, PDF sem texto); heurísticas de extração com casos que devem e que não devem ser reconhecidos.
  - `frontend`: fluxo da tela de cadastro (erros de obrigatórios sem chamar a API, e-mail inválido, salvamento e navegação para detalhes, erro da API no campo, preenchimento pelo PDF com complemento manual e origem `pdf`, bloqueio de arquivo inválido ou grande, falha de leitura sem impedir o cadastro manual).
  - Resultado: 43 testes passando (6 em `shared`, 30 em `backend`, 7 em `frontend`).
- **Checagem de tipos** (`npm run typecheck`) nos três pacotes, sem erros, e build de produção do frontend.
- **Teste ponta a ponta** com `docker compose up` e chamadas HTTP pelo nginx (porta 8080), contra o SQL Server real:
  - `/api/health` respondendo com o banco ok e migrations aplicadas na subida;
  - extração dos dois PDFs de exemplo (todos os campos no primeiro; telefone ausente no segundo);
  - arquivo falso (415), arquivo de 6 MB (413), envio sem arquivo (400);
  - cadastro com origem `pdf` e manual (201), e-mail duplicado com outra caixa (409), dados inválidos (400);
  - listagem ordenada, busca com acentos, busca por `%` tratada como texto, detalhes (200) e id inexistente (404);
  - recarregar `/candidatos/1` direto no navegador (rota do React servida pelo nginx);
  - acentos gravados corretamente no `NVARCHAR`, conferidos com `sqlcmd` no container.
- **Prints das telas** (Edge headless) em largura de desktop e estreita, que revelaram os problemas de layout da seção 5.
- ✏️ *Descreva sua conferência pessoal (o que você testou na mão, o que leu do código).*

## 7. Tempo aproximado

✏️ *Ex.: ~X h no total (planejamento, implementação, revisão, documentação).*

## 8. Dificuldades, limitações e melhorias

**Dificuldades**

- Reconstruir as linhas do texto do PDF: o pdf.js entrega fragmentos com coordenadas, sem quebras de linha confiáveis.
- Evitar falsos positivos de telefone (CPF, datas, períodos, matrículas).
- Rede instável durante o desenvolvimento, derrubando downloads do npm e do registro de imagens da Microsoft.

**Limitações** (detalhadas no README)

- Extração por heurística: nomes sem destaque no topo, layouts em colunas e telefones fora do padrão brasileiro podem não ser reconhecidos.
- Sem OCR para PDFs digitalizados.
- O PDF não é armazenado.
- Sem autenticação, edição, exclusão ou paginação.

**Melhorias com mais tempo**

- Edição e exclusão de candidatos; paginação e filtros na listagem.
- Guardar o PDF original (armazenamento de objetos) com link na tela de detalhes.
- OCR (ex.: Tesseract) para currículos digitalizados.
- Extrair também área de interesse e resumo; usar um modelo de linguagem como alternativa às heurísticas, com as regras atuais como fallback.
- Testes de integração do repositório contra um SQL Server real (Testcontainers) e testes E2E (Playwright).
- Pipeline de CI (GitHub Actions) rodando testes, typecheck e o build das imagens.
