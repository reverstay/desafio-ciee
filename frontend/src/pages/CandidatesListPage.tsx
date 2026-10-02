import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { api, ApiError, type CandidateSummary } from '../api';
import { formatDate, SOURCE_LABELS } from '../format';

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; candidates: CandidateSummary[] };

export function CandidatesListPage() {
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    setState({ kind: 'loading' });
    api
      .listCandidates(appliedSearch)
      .then((candidates) => active && setState({ kind: 'loaded', candidates }))
      .catch((err) =>
        active &&
        setState({ kind: 'error', message: err instanceof ApiError ? err.message : 'Falha ao carregar candidatos.' }),
      );
    return () => {
      active = false;
    };
  }, [appliedSearch]);

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    setAppliedSearch(search.trim());
  };

  return (
    <>
      <div className="page-header">
        <h1>Candidatos</h1>
        <Link to="/candidatos/novo" className="button button--primary">
          Novo candidato
        </Link>
      </div>

      <form className="search" onSubmit={handleSearch} role="search">
        <label htmlFor="search" className="visually-hidden">
          Buscar candidatos
        </label>
        <input
          id="search"
          type="search"
          placeholder="Buscar por nome, e-mail ou área"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button type="submit" className="button">
          Buscar
        </button>
      </form>

      {state.kind === 'loading' && <p className="muted">Carregando…</p>}
      {state.kind === 'error' && (
        <p className="alert alert--error" role="alert">
          {state.message}
        </p>
      )}
      {state.kind === 'loaded' && state.candidates.length === 0 && (
        <div className="card empty">
          {appliedSearch ? (
            <p>Nenhum candidato encontrado para “{appliedSearch}”.</p>
          ) : (
            <>
              <p>Nenhum candidato cadastrado ainda.</p>
              <Link to="/candidatos/novo">Cadastrar o primeiro candidato</Link>
            </>
          )}
        </div>
      )}
      {state.kind === 'loaded' && state.candidates.length > 0 && (
        <div className="card table-wrapper">
          <table>
            <thead>
              <tr>
                <th scope="col">Nome</th>
                <th scope="col">E-mail</th>
                <th scope="col">Área ou cargo</th>
                <th scope="col">Origem</th>
                <th scope="col">Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {state.candidates.map((candidate) => (
                <tr key={candidate.id}>
                  <td data-label="Nome">
                    <Link to={`/candidatos/${candidate.id}`}>{candidate.fullName}</Link>
                  </td>
                  <td data-label="E-mail">{candidate.email}</td>
                  <td data-label="Área ou cargo">{candidate.desiredRole ?? '—'}</td>
                  <td data-label="Origem">{SOURCE_LABELS[candidate.source]}</td>
                  <td data-label="Cadastro">{formatDate(candidate.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
