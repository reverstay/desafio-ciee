import { describe, expect, it } from 'vitest';
import { findName, findPhone, parseResume } from '../src/resumes/parse-resume.js';

describe('parseResume', () => {
  it('identifica nome, e-mail e telefone em um currículo típico', () => {
    const text = [
      'Mariana Costa Albuquerque',
      'Desenvolvedora Full Stack',
      'E-mail: mariana.albuquerque@exemplo.com.br | Celular: (41) 98765-4321',
      'Experiência',
      'Empresa Fictícia (2021 - 2025)',
    ].join('\n');

    expect(parseResume(text)).toMatchObject({
      fields: {
        fullName: 'Mariana Costa Albuquerque',
        email: 'mariana.albuquerque@exemplo.com.br',
        phone: '(41) 98765-4321',
      },
      missing: [],
    });
  });

  it('lista os campos não encontrados como missing', () => {
    const result = parseResume('Experiência profissional\nVendas e atendimento ao cliente desde 2015');
    expect(result.fields).toEqual({ fullName: null, email: null, phone: null });
    expect(result.missing).toEqual(['fullName', 'email', 'phone']);
  });

  it('remove o prefixo mailto: e normaliza o e-mail', () => {
    expect(parseResume('mailto:Joao.Silva@Exemplo.COM').fields.email).toBe('joao.silva@exemplo.com');
  });
});

describe('findName', () => {
  it('prefere a linha com rótulo "Nome:"', () => {
    expect(findName(['Currículo', 'Nome: Carlos Eduardo Lima', 'carlos@x.com'])).toBe('Carlos Eduardo Lima');
  });

  it('ignora cabeçalhos como "Currículo" e linhas com números ou e-mail', () => {
    expect(findName(['CURRÍCULO VITAE', 'carlos@x.com', '(41) 3333-4444', 'Ana Paula Souza'])).toBe('Ana Paula Souza');
  });

  it('converte nomes em maiúsculas mantendo as partículas em minúsculas', () => {
    expect(findName(['JOÃO PEDRO DOS SANTOS'])).toBe('João Pedro dos Santos');
  });

  it('não aceita uma única palavra como nome completo', () => {
    expect(findName(['Fernanda', 'Desenvolvedora'])).toBeNull();
  });
});

describe('findPhone', () => {
  it('aceita formatos comuns de telefone brasileiro', () => {
    expect(findPhone(['Telefone: +55 41 99876-5432'])).toBe('+55 41 99876-5432');
    expect(findPhone(['41 3222-1100'])).toBe('41 3222-1100');
    expect(findPhone(['Cel.: 41999998888'])).toBe('41999998888');
  });

  it('aceita número sem DDD apenas quando há rótulo de telefone', () => {
    expect(findPhone(['Fone: 3222-1100'])).toBe('3222-1100');
    expect(findPhone(['Código 3222-1100'])).toBeNull();
  });

  it('não confunde CPF, datas e períodos com telefone', () => {
    expect(findPhone(['CPF: 123.456.789-09', 'Período: 2019 - 2021', 'Nascimento 10/05/1990'])).toBeNull();
  });

  it('prefere o número que aparece junto de um rótulo', () => {
    expect(findPhone(['Matrícula 41 3000-2000', 'WhatsApp: (41) 99999-0000'])).toBe('(41) 99999-0000');
  });
});
