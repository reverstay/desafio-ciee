import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import type { Candidate } from '@curriculos/shared';
import { api, ApiError } from '../api';
import { formatDate, SOURCE_LABELS } from '../format';

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; candidate: Candidate };

export function CandidateDetailsPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const justCreated = Boolean((location.state as { created?: boolean } | null)?.created);
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    setState({ kind: 'loading' });
    api
      .getCandidate(id)
      .then((candidate) => active && setState({ kind: 'loaded', candidate }))
      .catch((err) =>
        active &&
        setState({ kind: 'error', message: err instanceof ApiError ? err.message : 'Falha ao carregar o candidato.' }),
      );
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <>
      <div className="page-header">
        <div>
          <Link to="/" className="back-link">
            ← Candidatos
          </Link>
          <h1>{state.kind === 'loaded' ? state.candidate.fullName : 'Detalhes do candidato'}</h1>
        </div>
      </div>

      {justCreated && state.kind === 'loaded' && (
        <p className="alert alert--success" role="status">
          Cadastro salvo com sucesso.
        </p>
      )}
      {state.kind === 'loading' && <p className="muted">Carregando…</p>}
      {state.kind === 'error' && (
        <p className="alert alert--error" role="alert">
          {state.message}
        </p>
      )}
      {state.kind === 'loaded' && (
        <div className="card">
          <dl className="details">
            <Detail label="Nome completo" value={state.candidate.fullName} />
            <Detail label="E-mail">
              <a href={`mailto:${state.candidate.email}`}>{state.candidate.email}</a>
            </Detail>
            <Detail label="Telefone" value={state.candidate.phone} />
            <Detail label="Área ou cargo de interesse" value={state.candidate.desiredRole} />
            <Detail label="Resumo profissional" value={state.candidate.summary} wide />
            <Detail label="Origem do cadastro" value={SOURCE_LABELS[state.candidate.source]} />
            <Detail label="Cadastrado em" value={formatDate(state.candidate.createdAt)} />
          </dl>
        </div>
      )}
    </>
  );
}

function Detail(props: { label: string; value?: string | null; wide?: boolean; children?: React.ReactNode }) {
  return (
    <div className={props.wide ? 'details__item details__item--wide' : 'details__item'}>
      <dt>{props.label}</dt>
      <dd className={props.wide ? 'preserve-lines' : undefined}>
        {props.children ?? (props.value || <span className="muted">Não informado</span>)}
      </dd>
    </div>
  );
}
