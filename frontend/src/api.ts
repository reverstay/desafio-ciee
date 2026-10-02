import type { Candidate, CandidateFormValues, CandidateSource, FieldErrors, PdfExtractionResult } from '@curriculos/shared';

export type CandidateSummary = Pick<Candidate, 'id' | 'fullName' | 'email' | 'desiredRole' | 'source' | 'createdAt'>;

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

/** Erro devolvido pela API, com a mensagem pronta para exibir. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly fieldErrors?: FieldErrors,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, init);
  } catch {
    throw new ApiError('Não foi possível conectar ao servidor. Verifique se a API está em execução.', 0, 'NETWORK');
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      body?.message ?? `Erro inesperado (HTTP ${response.status}).`,
      response.status,
      body?.code,
      body?.fieldErrors,
    );
  }
  return body as T;
}

export const api = {
  listCandidates: (search = '') =>
    request<CandidateSummary[]>(`/api/candidates${search ? `?search=${encodeURIComponent(search)}` : ''}`),

  getCandidate: (id: string | number) => request<Candidate>(`/api/candidates/${encodeURIComponent(id)}`),

  createCandidate: (values: CandidateFormValues, source: CandidateSource) =>
    request<Candidate>('/api/candidates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...values, source }),
    }),

  extractResume: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<PdfExtractionResult>('/api/resumes/extract', { method: 'POST', body: form });
  },
};
