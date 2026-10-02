import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  EMPTY_CANDIDATE_FORM,
  validateCandidate,
  type CandidateFormValues,
  type FieldErrors,
  type PdfExtractionResult,
} from '@curriculos/shared';
import { api, ApiError } from '../api';
import { CandidateForm } from '../components/CandidateForm';
import { PdfImport } from '../components/PdfImport';

type Mode = 'manual' | 'pdf';
type FieldName = keyof CandidateFormValues;

export function NewCandidatePage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('manual');
  const [values, setValues] = useState<CandidateFormValues>(EMPTY_CANDIDATE_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [autofilled, setAutofilled] = useState<FieldName[]>([]);
  const [importedFromPdf, setImportedFromPdf] = useState(false);
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const revalidate = (next: CandidateFormValues) => {
    const result = validateCandidate(next);
    setErrors(result.success ? {} : result.errors);
  };

  const handleChange = (field: FieldName, value: string) => {
    const next = { ...values, [field]: value };
    setValues(next);
    setAutofilled((current) => current.filter((name) => name !== field));
    if (triedSubmit) revalidate(next);
  };

  const handleExtracted = (result: PdfExtractionResult) => {
    const found = (Object.entries(result.fields) as Array<[FieldName, string | null]>).filter(
      (entry): entry is [FieldName, string] => Boolean(entry[1]),
    );
    if (found.length === 0) return;

    const next = { ...values, ...Object.fromEntries(found) };
    setValues(next);
    setAutofilled(found.map(([field]) => field));
    setImportedFromPdf(true);
    if (triedSubmit) revalidate(next);
  };

  const handleSubmit = async () => {
    setTriedSubmit(true);
    setFormError(null);

    const validation = validateCandidate(values);
    if (!validation.success) {
      setErrors(validation.errors);
      focusFirstError(validation.errors);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const candidate = await api.createCandidate(values, importedFromPdf ? 'pdf' : 'manual');
      navigate(`/candidatos/${candidate.id}`, { state: { created: true } });
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) {
        setErrors(err.fieldErrors);
        focusFirstError(err.fieldErrors);
      }
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível salvar o cadastro.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <Link to="/" className="back-link">
            ← Candidatos
          </Link>
          <h1>Novo candidato</h1>
        </div>
      </div>

      <div className="mode-switch" role="radiogroup" aria-label="Forma de cadastro">
        <ModeOption current={mode} value="manual" onSelect={setMode} title="Cadastro manual" description="Preencha o formulário" />
        <ModeOption current={mode} value="pdf" onSelect={setMode} title="Cadastro com PDF" description="Importe dados de um currículo" />
      </div>

      <div className="card">
        {mode === 'pdf' && <PdfImport onExtracted={handleExtracted} />}

        {formError && (
          <p className="alert alert--error" role="alert">
            {formError}
          </p>
        )}

        <CandidateForm
          values={values}
          errors={errors}
          autofilled={autofilled}
          submitting={submitting}
          onChange={handleChange}
          onSubmit={handleSubmit}
        />
      </div>
    </>
  );
}

function ModeOption(props: {
  current: Mode;
  value: Mode;
  title: string;
  description: string;
  onSelect: (mode: Mode) => void;
}) {
  const selected = props.current === props.value;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={`mode-option${selected ? ' mode-option--selected' : ''}`}
      onClick={() => props.onSelect(props.value)}
    >
      <strong>{props.title}</strong>
      <span>{props.description}</span>
    </button>
  );
}

function focusFirstError(errors: FieldErrors) {
  const order: FieldName[] = ['fullName', 'email', 'phone', 'desiredRole', 'summary'];
  const first = order.find((field) => errors[field]);
  if (first) document.getElementById(`field-${first}`)?.focus();
}
