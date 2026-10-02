import { Link, Route, Routes } from 'react-router';
import { CandidatesListPage } from './pages/CandidatesListPage';
import { NewCandidatePage } from './pages/NewCandidatePage';
import { CandidateDetailsPage } from './pages/CandidateDetailsPage';

export function App() {
  return (
    <>
      <header className="topbar">
        <div className="container">
          <Link to="/" className="brand">
            Cadastro de Currículos
          </Link>
        </div>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<CandidatesListPage />} />
          <Route path="/candidatos/novo" element={<NewCandidatePage />} />
          <Route path="/candidatos/:id" element={<CandidateDetailsPage />} />
          <Route
            path="*"
            element={
              <div className="card empty">
                <p>Página não encontrada.</p>
                <Link to="/">Voltar para a lista de candidatos</Link>
              </div>
            }
          />
        </Routes>
      </main>
    </>
  );
}
