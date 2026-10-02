import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { NewCandidatePage } from './NewCandidatePage';

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function renderPage() {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={['/candidatos/novo']}>
      <Routes>
        <Route path="/candidatos/novo" element={<NewCandidatePage />} />
        <Route path="/candidatos/:id" element={<p>Página de detalhes</p>} />
      </Routes>
    </MemoryRouter>,
  );
  return user;
}

const pdfFile = (size = 1024, name = 'curriculo.pdf', type = 'application/pdf') =>
  new File([new Uint8Array(size)], name, { type });

describe('Cadastro manual', () => {
  it('mostra erros dos campos obrigatórios sem chamar a API', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const user = renderPage();

    await user.click(screen.getByRole('button', { name: 'Salvar candidato' }));

    expect(screen.getByText('Informe o nome completo.')).toBeInTheDocument();
    expect(screen.getByText('Informe o e-mail.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Nome completo/)).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('valida o formato do e-mail', async () => {
    const user = renderPage();
    await user.type(screen.getByLabelText(/Nome completo/), 'Maria Silva');
    await user.type(screen.getByLabelText(/E-mail/), 'maria@');
    await user.click(screen.getByRole('button', { name: 'Salvar candidato' }));

    expect(screen.getByText(/Informe um e-mail válido/)).toBeInTheDocument();
  });

  it('salva e abre a tela de detalhes', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(201, { id: 7, fullName: 'Maria Silva', email: 'maria@x.com' }));
    const user = renderPage();

    await user.type(screen.getByLabelText(/Nome completo/), 'Maria Silva');
    await user.type(screen.getByLabelText(/E-mail/), 'maria@x.com');
    await user.click(screen.getByRole('button', { name: 'Salvar candidato' }));

    expect(await screen.findByText('Página de detalhes')).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/candidates');
    expect(JSON.parse(init!.body as string)).toMatchObject({ fullName: 'Maria Silva', source: 'manual' });
  });

  it('exibe o erro devolvido pela API no campo correspondente', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(409, {
        message: 'Já existe um candidato cadastrado com este e-mail.',
        fieldErrors: { email: 'Já existe um candidato cadastrado com este e-mail.' },
      }),
    );
    const user = renderPage();

    await user.type(screen.getByLabelText(/Nome completo/), 'Maria Silva');
    await user.type(screen.getByLabelText(/E-mail/), 'maria@x.com');
    await user.click(screen.getByRole('button', { name: 'Salvar candidato' }));

    expect(await screen.findAllByText('Já existe um candidato cadastrado com este e-mail.')).toHaveLength(2);
  });
});

describe('Cadastro com PDF', () => {
  it('preenche o mesmo formulário com os dados extraídos e permite completar', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse(200, {
          fields: { fullName: 'Mariana Costa', email: 'mariana@exemplo.com', phone: null },
          missing: ['phone'],
          textPreview: '',
        }),
      )
      .mockResolvedValueOnce(jsonResponse(201, { id: 3 }));
    const user = renderPage();

    await user.click(screen.getByRole('radio', { name: /Cadastro com PDF/ }));
    await user.upload(screen.getByLabelText('Arquivo do currículo (PDF)'), pdfFile());
    await user.click(screen.getByRole('button', { name: 'Ler currículo' }));

    expect(await screen.findByText(/Não identificamos telefone/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Nome completo/)).toHaveValue('Mariana Costa');
    expect(screen.getByLabelText(/E-mail/)).toHaveValue('mariana@exemplo.com');

    await user.type(screen.getByLabelText(/Telefone/), '(41) 99999-0000');
    await user.click(screen.getByRole('button', { name: 'Salvar candidato' }));

    await screen.findByText('Página de detalhes');
    const body = JSON.parse(fetchMock.mock.calls[1][1]!.body as string);
    expect(body).toMatchObject({ fullName: 'Mariana Costa', phone: '(41) 99999-0000', source: 'pdf' });
  });

  it('bloqueia arquivo que não é PDF ou maior que 5 MB antes do envio', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const user = userEvent.setup({ applyAccept: false });
    render(
      <MemoryRouter>
        <NewCandidatePage />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('radio', { name: /Cadastro com PDF/ }));
    const input = screen.getByLabelText('Arquivo do currículo (PDF)');

    await user.upload(input, pdfFile(10, 'foto.png', 'image/png'));
    expect(screen.getByRole('alert')).toHaveTextContent('Arquivo inválido');

    await user.upload(input, pdfFile(5 * 1024 * 1024 + 1));
    expect(screen.getByRole('alert')).toHaveTextContent('excede o limite de 5 MB');
    expect(screen.getByRole('button', { name: 'Ler currículo' })).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('mostra a falha de leitura e mantém o cadastro manual disponível', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(422, { message: 'Não foi possível ler o PDF.', code: 'PDF_READ_FAILED' }))
      .mockResolvedValueOnce(jsonResponse(201, { id: 9 }));
    const user = renderPage();

    await user.click(screen.getByRole('radio', { name: /Cadastro com PDF/ }));
    await user.upload(screen.getByLabelText('Arquivo do currículo (PDF)'), pdfFile());
    await user.click(screen.getByRole('button', { name: 'Ler currículo' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível ler o PDF.');

    await user.type(screen.getByLabelText(/Nome completo/), 'Pedro Alves');
    await user.type(screen.getByLabelText(/E-mail/), 'pedro@x.com');
    await user.click(screen.getByRole('button', { name: 'Salvar candidato' }));

    await waitFor(() => expect(screen.getByText('Página de detalhes')).toBeInTheDocument());
  });
});
