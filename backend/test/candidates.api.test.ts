import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { InMemoryCandidateRepository } from './in-memory-repository.js';

const valid = {
  fullName: 'Maria Silva',
  email: 'maria@exemplo.com',
  phone: '(41) 99999-1234',
  desiredRole: 'Desenvolvimento',
  summary: 'Experiência com React e Node.js.',
};

let repository: InMemoryCandidateRepository;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  repository = new InMemoryCandidateRepository();
  app = createApp({ candidates: repository, extractPdfText: async () => '' });
});

describe('POST /api/candidates', () => {
  it('salva um cadastro manual válido', async () => {
    const response = await request(app).post('/api/candidates').send(valid);

    expect(response.status).toBe(201);
    expect(response.headers.location).toBe('/api/candidates/1');
    expect(response.body).toMatchObject({ id: 1, ...valid, source: 'manual' });
  });

  it('registra a origem "pdf" quando informada', async () => {
    const response = await request(app).post('/api/candidates').send({ ...valid, source: 'pdf' });
    expect(response.body.source).toBe('pdf');
  });

  it('salva apenas com os campos obrigatórios', async () => {
    const response = await request(app).post('/api/candidates').send({ fullName: 'Ana Lima', email: 'ana@x.com' });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ phone: null, desiredRole: null, summary: null });
  });

  it('rejeita campos obrigatórios ausentes com mensagens por campo', async () => {
    const response = await request(app).post('/api/candidates').send({ phone: '41999998888' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.fieldErrors).toEqual({
      fullName: 'Informe o nome completo.',
      email: 'Informe o e-mail.',
    });
    expect(repository.items).toHaveLength(0);
  });

  it('rejeita e-mail com formato inválido', async () => {
    const response = await request(app).post('/api/candidates').send({ ...valid, email: 'maria.exemplo.com' });
    expect(response.status).toBe(400);
    expect(response.body.fieldErrors.email).toMatch(/e-mail válido/);
  });

  it('impede e-mail duplicado, ignorando maiúsculas', async () => {
    await request(app).post('/api/candidates').send(valid);
    const response = await request(app)
      .post('/api/candidates')
      .send({ ...valid, email: 'MARIA@exemplo.com' });

    expect(response.status).toBe(409);
    expect(response.body.fieldErrors.email).toMatch(/Já existe/);
  });

  it('responde 400 para JSON malformado', async () => {
    const response = await request(app)
      .post('/api/candidates')
      .set('Content-Type', 'application/json')
      .send('{"fullName":');
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_JSON');
  });
});

describe('GET /api/candidates', () => {
  it('lista os candidatos do mais recente para o mais antigo', async () => {
    await request(app).post('/api/candidates').send(valid);
    await request(app).post('/api/candidates').send({ ...valid, fullName: 'João Souza', email: 'joao@x.com' });

    const response = await request(app).get('/api/candidates');
    expect(response.status).toBe(200);
    expect(response.body.map((c: { fullName: string }) => c.fullName)).toEqual(['João Souza', 'Maria Silva']);
    expect(response.body[0]).not.toHaveProperty('summary');
  });

  it('filtra pelo termo de busca', async () => {
    await request(app).post('/api/candidates').send(valid);
    await request(app).post('/api/candidates').send({ ...valid, fullName: 'João Souza', email: 'joao@x.com' });

    const response = await request(app).get('/api/candidates').query({ search: 'joão' });
    expect(response.body).toHaveLength(1);
  });
});

describe('GET /api/candidates/:id', () => {
  it('devolve os detalhes do candidato', async () => {
    await request(app).post('/api/candidates').send(valid);
    const response = await request(app).get('/api/candidates/1');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject(valid);
  });

  it('responde 404 para candidato inexistente e 400 para id inválido', async () => {
    expect((await request(app).get('/api/candidates/99')).status).toBe(404);
    expect((await request(app).get('/api/candidates/abc')).status).toBe(400);
  });
});
