import { getDocumentProxy } from 'unpdf';

/** Limite de páginas lidas: os dados de contato ficam no início do currículo. */
const MAX_PAGES = 5;

type TextItem = { str: string; transform: number[]; hasEOL?: boolean };

/**
 * Extrai o texto do PDF preservando as quebras de linha.
 *
 * O pdf.js devolve fragmentos soltos com coordenadas; agrupamos os fragmentos
 * pela posição vertical para reconstruir as linhas, o que é necessário para
 * identificar o nome (normalmente a primeira linha do currículo).
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  try {
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, MAX_PAGES); pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(groupIntoLines(content.items as TextItem[]));
    }
    return pages.join('\n');
  } finally {
    // Encerra o documento e libera a memória do pdf.js.
    await pdf.loadingTask.destroy();
  }
}

function groupIntoLines(items: TextItem[]): string {
  const lines: { y: number; parts: { x: number; text: string }[] }[] = [];
  for (const item of items) {
    if (!item.str || !item.transform) continue;
    const x = item.transform[4];
    const y = item.transform[5];
    // Fragmentos com diferença vertical pequena pertencem à mesma linha.
    let line = lines.find((candidate) => Math.abs(candidate.y - y) < 3);
    if (!line) {
      line = { y, parts: [] };
      lines.push(line);
    }
    line.parts.push({ x, text: item.str });
  }

  return lines
    .sort((a, b) => b.y - a.y) // PDF mede y de baixo para cima
    .map((line) =>
      line.parts
        .sort((a, b) => a.x - b.x)
        .map((part) => part.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean)
    .join('\n');
}
