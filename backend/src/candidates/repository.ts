import sql from 'mssql';
import type { Candidate, CandidateInput, CandidateSource } from '@curriculos/shared';

export type CandidateSummary = Pick<Candidate, 'id' | 'fullName' | 'email' | 'desiredRole' | 'source' | 'createdAt'>;

export interface CandidateRepository {
  create(input: CandidateInput, source: CandidateSource): Promise<Candidate>;
  list(search?: string): Promise<CandidateSummary[]>;
  findById(id: number): Promise<Candidate | null>;
  existsByEmail(email: string): Promise<boolean>;
}

type CandidateRow = {
  Id: number;
  FullName: string;
  Email: string;
  Phone: string | null;
  DesiredRole: string | null;
  Summary: string | null;
  Source: CandidateSource;
  CreatedAt: Date;
};

const toCandidate = (row: CandidateRow): Candidate => ({
  id: row.Id,
  fullName: row.FullName,
  email: row.Email,
  phone: row.Phone,
  desiredRole: row.DesiredRole,
  summary: row.Summary,
  source: row.Source,
  createdAt: row.CreatedAt.toISOString(),
});

/** Escapa os curingas do LIKE para que a busca trate %, _ e [ como texto. */
const escapeLike = (text: string) => text.replace(/[[%_]/g, '[$&]');

/** Persistência no SQL Server. Todas as consultas são parametrizadas. */
export class SqlCandidateRepository implements CandidateRepository {
  constructor(private readonly pool: sql.ConnectionPool) {}

  async create(input: CandidateInput, source: CandidateSource): Promise<Candidate> {
    const result = await this.pool
      .request()
      .input('fullName', sql.NVarChar(150), input.fullName)
      .input('email', sql.NVarChar(254), input.email)
      .input('phone', sql.NVarChar(30), input.phone)
      .input('desiredRole', sql.NVarChar(120), input.desiredRole)
      .input('summary', sql.NVarChar(2000), input.summary)
      .input('source', sql.VarChar(10), source).query<CandidateRow>(`
        INSERT INTO dbo.Candidates (FullName, Email, Phone, DesiredRole, Summary, Source)
        OUTPUT INSERTED.Id, INSERTED.FullName, INSERTED.Email, INSERTED.Phone,
               INSERTED.DesiredRole, INSERTED.Summary, INSERTED.Source, INSERTED.CreatedAt
        VALUES (@fullName, @email, @phone, @desiredRole, @summary, @source);
      `);
    return toCandidate(result.recordset[0]);
  }

  async list(search?: string): Promise<CandidateSummary[]> {
    const request = this.pool.request();
    let where = '';
    if (search) {
      request.input('search', sql.NVarChar(310), `%${escapeLike(search)}%`);
      where = 'WHERE FullName LIKE @search OR Email LIKE @search OR DesiredRole LIKE @search';
    }
    const result = await request.query<CandidateRow>(`
      SELECT Id, FullName, Email, DesiredRole, Source, CreatedAt
      FROM dbo.Candidates
      ${where}
      ORDER BY CreatedAt DESC, Id DESC;
    `);
    return result.recordset.map((row) => {
      const { id, fullName, email, desiredRole, source, createdAt } = toCandidate(row);
      return { id, fullName, email, desiredRole, source, createdAt };
    });
  }

  async findById(id: number): Promise<Candidate | null> {
    const result = await this.pool
      .request()
      .input('id', sql.Int, id)
      .query<CandidateRow>(`
        SELECT Id, FullName, Email, Phone, DesiredRole, Summary, Source, CreatedAt
        FROM dbo.Candidates
        WHERE Id = @id;
      `);
    const row = result.recordset[0];
    return row ? toCandidate(row) : null;
  }

  async existsByEmail(email: string): Promise<boolean> {
    const result = await this.pool
      .request()
      .input('email', sql.NVarChar(254), email)
      .query('SELECT 1 AS found FROM dbo.Candidates WHERE Email = @email;');
    return result.recordset.length > 0;
  }
}
