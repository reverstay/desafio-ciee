import type { CandidateSource } from '@curriculos/shared';

export const SOURCE_LABELS: Record<CandidateSource, string> = {
  manual: 'Manual',
  pdf: 'PDF',
};

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export const formatDate = (iso: string) => dateFormatter.format(new Date(iso));
