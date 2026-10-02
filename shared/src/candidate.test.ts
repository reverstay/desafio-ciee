import { describe, expect, it } from 'vitest';
import { validateCandidate } from './candidate.js';

const valid = {
  fullName: '  Maria Silva  ',
  email: 'Maria.Silva@Example.com',
  phone: '(41) 99999-1234',
  desiredRole: 'Desenvolvedora Front-end',
  summary: 'Cinco anos com React.',
};

describe('validateCandidate', () => {
  it('aceita dados válidos e normaliza espaços e e-mail', () => {
    const result = validateCandidate(valid);
    expect(result).toEqual({
      success: true,
      data: { ...valid, fullName: 'Maria Silva', email: 'maria.silva@example.com' },
    });
  });

  it('exige nome completo e e-mail', () => {
    const result = validateCandidate({ fullName: '   ', email: '' });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.fullName).toBe('Informe o nome completo.');
    expect(result.errors.email).toBe('Informe o e-mail.');
  });

  it('rejeita e-mail em formato inválido', () => {
    const result = validateCandidate({ ...valid, email: 'maria@' });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.email).toMatch(/e-mail válido/);
  });

  it('transforma campos opcionais vazios em null', () => {
    const result = validateCandidate({ fullName: 'Ana', email: 'ana@x.com', phone: ' ', summary: '' });
    expect(result.success && result.data).toMatchObject({ phone: null, desiredRole: null, summary: null });
  });

  it('rejeita telefone com letras ou poucos dígitos', () => {
    const letters = validateCandidate({ ...valid, phone: '41 abc' });
    const short = validateCandidate({ ...valid, phone: '1234' });
    expect(letters.success || letters.errors.phone).toMatch(/apenas números/);
    expect(short.success || short.errors.phone).toMatch(/8 dígitos/);
  });

  it('respeita os limites de tamanho', () => {
    const result = validateCandidate({ ...valid, fullName: 'a'.repeat(151) });
    expect(result.success || result.errors.fullName).toMatch(/no máximo 150/);
  });
});
