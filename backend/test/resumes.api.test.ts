import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { extractPdfText } from '../src/resumes/pdf-text.js';
import type { PdfTextExtractor } from '../src/resumes/routes.js';
import { InMemoryCandidateRepository } from './in-memory-repository.js';

const samplesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../samples');
const fakePdf = Buffer.from('%PDF-1.7\nconteúdo qualquer');

const appWith = (extractor: PdfTextExtractor) =>
  createApp({ candidates: new InMemoryCandidateRepository(), extractPdfText: extractor });

describe('POST /api/resumes/extract', () => {
  it('extrai os dados do currículo fictício de exemplo (PDF real)', async () => {
    const pdf = await readFile(path.join(samplesDir, 'curriculo-ficticio.pdf'));
    const response = await request(appWith(extractPdfText))
      .post('/api/resumes/extract')
      .attach('file', pdf, { filename: 'curriculo.pdf', contentType: 'application/pdf' });

    expect(response.status).toBe(200);
    expect(response.body.fields).toEqual({
      fullName: 'Mariana Costa Albuquerque',
      email: 'mariana.albuquerque@exemplo.com.br',
      phone: '(41) 98765-4321',
    });
    expect(response.body.missing).toEqual([]);
  });

  it('informa os campos não encontrados no segundo exemplo', async () => {
    const pdf = await readFile(path.join(samplesDir, 'curriculo-sem-telefone.pdf'));
    const response = await request(appWith(extractPdfText))
      .post('/api/resumes/extract')
      .attach('file', pdf, 'sem-telefone.pdf');

    expect(response.body.fields).toEqual({
      fullName: 'João Pedro dos Santos',
      email: 'joao.santos@exemplo.com',
      phone: null,
    });
    expect(response.body.missing).toEqual(['phone']);
  });

  it('exige um arquivo', async () => {
    const response = await request(appWith(async () => 'x')).post('/api/resumes/extract');
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('FILE_REQUIRED');
  });

  it('rejeita arquivo que não é PDF mesmo com extensão .pdf', async () => {
    const pdf = await readFile(path.join(samplesDir, 'arquivo-invalido.pdf'));
    const response = await request(appWith(async () => 'x'))
      .post('/api/resumes/extract')
      .attach('file', pdf, { filename: 'arquivo-invalido.pdf', contentType: 'application/pdf' });

    expect(response.status).toBe(415);
    expect(response.body.message).toMatch(/formato PDF/);
  });

  it('rejeita arquivos maiores que 5 MB', async () => {
    const big = Buffer.concat([fakePdf, Buffer.alloc(5 * 1024 * 1024)]);
    const response = await request(appWith(async () => 'x'))
      .post('/api/resumes/extract')
      .attach('file', big, 'grande.pdf');

    expect(response.status).toBe(413);
    expect(response.body.message).toMatch(/5 MB/);
  });

  it('devolve 422 quando a leitura do PDF falha', async () => {
    const response = await request(
      appWith(async () => {
        throw new Error('Invalid PDF structure');
      }),
    )
      .post('/api/resumes/extract')
      .attach('file', fakePdf, 'corrompido.pdf');

    expect(response.status).toBe(422);
    expect(response.body.code).toBe('PDF_READ_FAILED');
  });

  it('devolve 422 quando o PDF não tem texto (digitalizado)', async () => {
    const response = await request(appWith(async () => '   \n '))
      .post('/api/resumes/extract')
      .attach('file', fakePdf, 'scan.pdf');

    expect(response.status).toBe(422);
    expect(response.body.code).toBe('PDF_NO_TEXT');
  });

  it('a leitura real falha de forma controlada com um PDF corrompido', async () => {
    const response = await request(appWith(extractPdfText))
      .post('/api/resumes/extract')
      .attach('file', fakePdf, 'corrompido.pdf');

    expect(response.status).toBe(422);
  });
});
