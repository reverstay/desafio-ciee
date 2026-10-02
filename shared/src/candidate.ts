import { z } from 'zod';

/**
 * Regras de validação do candidato. São usadas pelo formulário (React) e
 * pela API (Node), para que o cadastro manual e o cadastro com PDF passem
 * exatamente pelas mesmas regras.
 */

export const FIELD_LIMITS = {
  fullName: 150,
  email: 254,
  phone: 30,
  desiredRole: 120,
  summary: 2000,
} as const;

/** Tamanho máximo aceito para o PDF do currículo (5 MB). */
export const MAX_PDF_SIZE_BYTES = 5 * 1024 * 1024;

/** Converte string vazia (ou só espaços) em null para os campos opcionais. */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { error: `${label} deve ter no máximo ${max} caracteres.` })
    .nullish()
    .transform((value) => (value ? value : null));

export const candidateSchema = z.object({
  fullName: z
    .string({ error: 'Informe o nome completo.' })
    .trim()
    .min(1, { error: 'Informe o nome completo.' })
    .max(FIELD_LIMITS.fullName, {
      error: `Nome completo deve ter no máximo ${FIELD_LIMITS.fullName} caracteres.`,
    }),
  email: z
    .string({ error: 'Informe o e-mail.' })
    .trim()
    .min(1, { error: 'Informe o e-mail.' })
    .max(FIELD_LIMITS.email, {
      error: `E-mail deve ter no máximo ${FIELD_LIMITS.email} caracteres.`,
    })
    .pipe(z.email({ error: 'Informe um e-mail válido, por exemplo nome@empresa.com.' }))
    .transform((value) => value.toLowerCase()),
  phone: optionalText(FIELD_LIMITS.phone, 'Telefone').refine(
    (value) => value === null || /^\+?[\d\s().-]+$/.test(value),
    { error: 'Telefone deve conter apenas números, espaços, parênteses, hífen ou +.' },
  ).refine(
    (value) => value === null || value.replace(/\D/g, '').length >= 8,
    { error: 'Telefone deve ter pelo menos 8 dígitos.' },
  ),
  desiredRole: optionalText(FIELD_LIMITS.desiredRole, 'Área ou cargo de interesse'),
  summary: optionalText(FIELD_LIMITS.summary, 'Resumo profissional'),
});

/** Dados digitados no formulário (todos os campos como texto). */
export type CandidateFormValues = {
  fullName: string;
  email: string;
  phone: string;
  desiredRole: string;
  summary: string;
};

/** Dados já validados e normalizados, prontos para persistir. */
export type CandidateInput = z.output<typeof candidateSchema>;

/** Candidato como devolvido pela API. */
export type Candidate = CandidateInput & {
  id: number;
  source: CandidateSource;
  createdAt: string;
};

export type CandidateSource = 'manual' | 'pdf';

/** Resultado da leitura de um PDF: campos encontrados ficam preenchidos, os demais null. */
export type PdfExtractionResult = {
  fields: {
    fullName: string | null;
    email: string | null;
    phone: string | null;
  };
  /** Nomes dos campos que não foram identificados no texto. */
  missing: Array<'fullName' | 'email' | 'phone'>;
  /** Trecho inicial do texto extraído, para a pessoa conferir. */
  textPreview: string;
};

export type FieldErrors = Partial<Record<keyof CandidateFormValues, string>>;

export const EMPTY_CANDIDATE_FORM: CandidateFormValues = {
  fullName: '',
  email: '',
  phone: '',
  desiredRole: '',
  summary: '',
};

/** Valida os dados e devolve a primeira mensagem de erro de cada campo. */
export function validateCandidate(
  data: unknown,
): { success: true; data: CandidateInput } | { success: false; errors: FieldErrors } {
  const result = candidateSchema.safeParse(data);
  if (result.success) return { success: true, data: result.data };

  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as keyof CandidateFormValues | undefined;
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return { success: false, errors };
}
