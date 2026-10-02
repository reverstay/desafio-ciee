import type { Candidate, CandidateInput, CandidateSource } from '@curriculos/shared';
import type { CandidateRepository, CandidateSummary } from '../src/candidates/repository.js';

/** Implementação em memória usada para testar as rotas sem SQL Server. */
export class InMemoryCandidateRepository implements CandidateRepository {
  readonly items: Candidate[] = [];

  async create(input: CandidateInput, source: CandidateSource): Promise<Candidate> {
    const candidate: Candidate = {
      ...input,
      id: this.items.length + 1,
      source,
      createdAt: new Date(Date.UTC(2026, 9, 1, 12, this.items.length)).toISOString(),
    };
    this.items.push(candidate);
    return candidate;
  }

  async list(search?: string): Promise<CandidateSummary[]> {
    const term = search?.toLowerCase();
    return this.items
      .filter((c) => !term || [c.fullName, c.email, c.desiredRole ?? ''].some((v) => v.toLowerCase().includes(term)))
      .reverse()
      .map(({ id, fullName, email, desiredRole, source, createdAt }) => ({
        id,
        fullName,
        email,
        desiredRole,
        source,
        createdAt,
      }));
  }

  async findById(id: number): Promise<Candidate | null> {
    return this.items.find((c) => c.id === id) ?? null;
  }

  async existsByEmail(email: string): Promise<boolean> {
    return this.items.some((c) => c.email === email);
  }
}
