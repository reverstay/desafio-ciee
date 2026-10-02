import type { FormEvent } from 'react';
import { FIELD_LIMITS, type CandidateFormValues, type FieldErrors } from '@curriculos/shared';

type Props = {
  values: CandidateFormValues;
  errors: FieldErrors;
  /** Campos preenchidos automaticamente a partir do PDF (recebem um destaque). */
  autofilled?: ReadonlyArray<keyof CandidateFormValues>;
  submitting: boolean;
  onChange: (field: keyof CandidateFormValues, value: string) => void;
  onSubmit: () => void;
};

type FieldConfig = {
  name: keyof CandidateFormValues;
  label: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  multiline?: boolean;
};

const FIELDS: FieldConfig[] = [
  { name: 'fullName', label: 'Nome completo', required: true, autoComplete: 'name' },
  { name: 'email', label: 'E-mail', required: true, type: 'email', placeholder: 'nome@empresa.com', autoComplete: 'email' },
  { name: 'phone', label: 'Telefone', type: 'tel', placeholder: '(41) 99999-0000', autoComplete: 'tel' },
  { name: 'desiredRole', label: 'Área ou cargo de interesse', placeholder: 'Ex.: Desenvolvimento, Atendimento, Financeiro' },
  { name: 'summary', label: 'Resumo profissional', multiline: true },
];

/** Formulário único usado tanto no cadastro manual quanto no cadastro com PDF. */
export function CandidateForm({ values, errors, autofilled = [], submitting, onChange, onSubmit }: Props) {
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form className="candidate-form" onSubmit={handleSubmit} noValidate>
      {FIELDS.map((field) => {
        const id = `field-${field.name}`;
        const error = errors[field.name];
        const filled = autofilled.includes(field.name);
        const common = {
          id,
          name: field.name,
          value: values[field.name],
          maxLength: FIELD_LIMITS[field.name],
          'aria-invalid': Boolean(error),
          'aria-describedby': error ? `${id}-error` : undefined,
          className: filled ? 'autofilled' : undefined,
          onChange: (event: { target: { value: string } }) => onChange(field.name, event.target.value),
        };

        return (
          <div key={field.name} className={`field${field.multiline ? ' field--wide' : ''}`}>
            <label htmlFor={id}>
              {field.label}
              {field.required ? <span className="required" aria-hidden="true"> *</span> : <span className="optional"> (opcional)</span>}
              {filled && <span className="badge">do PDF</span>}
            </label>
            {field.multiline ? (
              <textarea {...common} rows={5} />
            ) : (
              <input
                {...common}
                type={field.type ?? 'text'}
                placeholder={field.placeholder}
                autoComplete={field.autoComplete}
                required={field.required}
              />
            )}
            {field.multiline && (
              <small className="hint">
                {values[field.name].length}/{FIELD_LIMITS[field.name]}
              </small>
            )}
            {error && (
              <p id={`${id}-error`} className="field-error" role="alert">
                {error}
              </p>
            )}
          </div>
        );
      })}

      <div className="form-actions">
        <button type="submit" className="button button--primary" disabled={submitting}>
          {submitting ? 'Salvando…' : 'Salvar candidato'}
        </button>
      </div>
    </form>
  );
}
