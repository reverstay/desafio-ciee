import { useRef, useState, type ChangeEvent } from 'react';
import { MAX_PDF_SIZE_BYTES, type PdfExtractionResult } from '@curriculos/shared';
import { api, ApiError } from '../api';

type Props = {
  onExtracted: (result: PdfExtractionResult) => void;
};

type Status =
  | { kind: 'idle' }
  | { kind: 'reading' }
  | { kind: 'done'; result: PdfExtractionResult }
  | { kind: 'error'; message: string };

const FIELD_LABELS: Record<PdfExtractionResult['missing'][number], string> = {
  fullName: 'nome',
  email: 'e-mail',
  phone: 'telefone',
};

const formatSize = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;

/** Validação feita antes do envio; a API repete as mesmas checagens. */
export function validatePdfFile(file: File): string | null {
  const looksLikePdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!looksLikePdf) return 'Arquivo inválido. Selecione um currículo em formato PDF.';
  if (file.size === 0) return 'O arquivo selecionado está vazio.';
  if (file.size > MAX_PDF_SIZE_BYTES) {
    return `O arquivo tem ${formatSize(file.size)} e excede o limite de 5 MB.`;
  }
  return null;
}

const joinLabels = (labels: string[]) =>
  labels.length > 1 ? `${labels.slice(0, -1).join(', ')} e ${labels[labels.length - 1]}` : labels[0];

export function PdfImport({ onExtracted }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    if (!selected) return setStatus({ kind: 'idle' });

    const error = validatePdfFile(selected);
    setStatus(error ? { kind: 'error', message: error } : { kind: 'idle' });
  };

  const handleRead = async () => {
    if (!file) return setStatus({ kind: 'error', message: 'Selecione um arquivo PDF para importar.' });
    const error = validatePdfFile(file);
    if (error) return setStatus({ kind: 'error', message: error });

    setStatus({ kind: 'reading' });
    try {
      const result = await api.extractResume(file);
      setStatus({ kind: 'done', result });
      onExtracted(result);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Falha inesperada ao ler o PDF.';
      setStatus({ kind: 'error', message });
    }
  };

  const fileError = status.kind === 'error';

  return (
    <section className="pdf-import" aria-labelledby="pdf-import-title">
      <h2 id="pdf-import-title">Importar dados de um currículo em PDF</h2>
      <p className="muted">
        O PDF é opcional e tem limite de 5 MB. Tentamos identificar nome, e-mail e telefone; confira e complete os
        dados no formulário antes de salvar.
      </p>

      <div className="pdf-import__controls">
        <label htmlFor="resume-file" className="visually-hidden">
          Arquivo do currículo (PDF)
        </label>
        <input
          ref={inputRef}
          id="resume-file"
          type="file"
          accept="application/pdf,.pdf"
          onChange={handleFileChange}
          aria-invalid={fileError}
        />
        <button
          type="button"
          className="button"
          onClick={handleRead}
          disabled={!file || status.kind === 'reading' || fileError}
        >
          {status.kind === 'reading' ? 'Lendo PDF…' : 'Ler currículo'}
        </button>
      </div>

      <div aria-live="polite">
        {status.kind === 'error' && (
          <p className="alert alert--error" role="alert">
            {status.message} Você ainda pode preencher o formulário manualmente.
          </p>
        )}
        {status.kind === 'done' && <ExtractionSummary result={status.result} />}
      </div>
    </section>
  );
}

function ExtractionSummary({ result }: { result: PdfExtractionResult }) {
  const found = (Object.keys(FIELD_LABELS) as Array<keyof typeof FIELD_LABELS>).filter(
    (field) => !result.missing.includes(field),
  );

  if (found.length === 0) {
    return (
      <p className="alert alert--warning">
        Lemos o PDF, mas não identificamos nome, e-mail nem telefone. Preencha os campos manualmente.
      </p>
    );
  }

  return (
    <p className={`alert ${result.missing.length ? 'alert--warning' : 'alert--success'}`}>
      PDF lido. Preenchemos: {joinLabels(found.map((field) => FIELD_LABELS[field]))}.
      {result.missing.length > 0 &&
        ` Não identificamos ${joinLabels(result.missing.map((field) => FIELD_LABELS[field]))}; preencha manualmente.`}{' '}
      Revise os dados antes de salvar.
    </p>
  );
}
