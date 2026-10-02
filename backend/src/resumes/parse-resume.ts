import type { PdfExtractionResult } from '@curriculos/shared';

/**
 * Heurísticas simples para encontrar nome, e-mail e telefone no texto do
 * currículo. Não pretendem acertar todos os formatos: o que não for
 * identificado volta como null e a pessoa preenche no formulário.
 */

const EMAIL_REGEX = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/i;

// Sequência que começa e termina em dígito e pode ter espaços, pontos, hífens e parênteses.
const PHONE_CANDIDATE_REGEX = /(?:\+\s?)?\(?\d[\d\s().-]{6,}\d/g;
const PHONE_LABEL_REGEX = /\b(tel|telefone|fone|celular|cel|whatsapp|contato|phone|mobile)\b/i;
const CPF_REGEX = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
const DATE_OR_PERIOD_REGEX = /\b(19|20)\d{2}\b.*\b(19|20)\d{2}\b|\d{1,2}\/\d{1,2}\/\d{2,4}/;

const NAME_LABEL_REGEX = /^\s*nome(?:\s+completo)?\s*[:-]\s*(.+)$/i;
const HEADING_WORDS =
  /\b(curr[ií]culo|curriculum|vitae|resume|résumé|dados pessoais|contato|perfil|objetivo|resumo|experi[eê]ncia|forma[cç][aã]o|endere[cç]o)\b/i;
// Letras (inclusive acentuadas), espaço, ponto, apóstrofo e hífen.
const NAME_CHARS_REGEX = /^[\p{L}][\p{L}\s.'-]*$/u;
const LOWERCASE_PARTICLES = new Set(['da', 'das', 'de', 'do', 'dos', 'e']);

/** Quantas linhas do topo são consideradas ao procurar o nome sem rótulo. */
const NAME_SEARCH_LINES = 8;

export function parseResume(text: string): PdfExtractionResult {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const fields = {
    fullName: findName(lines),
    email: findEmail(text),
    phone: findPhone(lines),
  };

  const missing = (Object.keys(fields) as Array<keyof typeof fields>).filter((key) => fields[key] === null);

  return { fields, missing, textPreview: lines.slice(0, 15).join('\n').slice(0, 1000) };
}

export function findEmail(text: string): string | null {
  const match = text.replace(/mailto:/gi, ' ').match(EMAIL_REGEX);
  return match ? match[0].toLowerCase() : null;
}

export function findPhone(lines: string[]): string | null {
  let unlabeled: string | null = null;

  for (const line of lines) {
    const labeled = PHONE_LABEL_REGEX.test(line);
    for (const match of line.matchAll(PHONE_CANDIDATE_REGEX)) {
      const raw = match[0].trim();
      if (CPF_REGEX.test(raw) || DATE_OR_PERIOD_REGEX.test(raw)) continue;

      const digits = raw.replace(/\D/g, '');
      // Com DDD (10–11 dígitos) ou com código do país (12–13). Sem DDD só se a linha tiver rótulo.
      const plausible = (digits.length >= 10 && digits.length <= 13) || (labeled && digits.length >= 8 && digits.length <= 9);
      if (!plausible) continue;

      const phone = raw.replace(/\s+/g, ' ');
      if (labeled) return phone;
      unlabeled ??= phone;
    }
  }
  return unlabeled;
}

export function findName(lines: string[]): string | null {
  // 1) Linha com rótulo explícito: "Nome: Fulano de Tal".
  for (const line of lines) {
    const labeled = line.match(NAME_LABEL_REGEX);
    if (labeled && looksLikeName(labeled[1].trim())) return formatName(labeled[1].trim());
  }

  // 2) Primeira linha do topo do documento que tenha cara de nome próprio.
  for (const line of lines.slice(0, NAME_SEARCH_LINES)) {
    if (looksLikeName(line)) return formatName(line);
  }
  return null;
}

function looksLikeName(line: string): boolean {
  if (line.length < 5 || line.length > 80) return false;
  if (!NAME_CHARS_REGEX.test(line) || HEADING_WORDS.test(line)) return false;
  const words = line.split(' ');
  return words.length >= 2 && words.length <= 6;
}

/** Nomes escritos todo em maiúsculas viram "Maria da Silva". */
function formatName(name: string): string {
  if (name !== name.toUpperCase()) return name;
  return name
    .toLowerCase()
    .split(' ')
    .map((word, index) =>
      index > 0 && LOWERCASE_PARTICLES.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ');
}
