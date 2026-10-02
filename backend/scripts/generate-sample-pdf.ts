/**
 * Gera os currículos fictícios usados para testar a importação.
 * Saída em samples/ na raiz do repositório. Todos os dados são inventados.
 */
import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';

const samplesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../samples');

type Section = { title: string; lines: string[] };

function writePdf(file: string, header: string[], sections: Section[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56, info: { Title: 'Currículo fictício' } });
    const stream = createWriteStream(path.join(samplesDir, file));
    doc.pipe(stream);

    const [name, ...contact] = header;
    doc.font('Helvetica-Bold').fontSize(22).text(name);
    doc.moveDown(0.3).font('Helvetica').fontSize(10.5).fillColor('#444');
    for (const line of contact) doc.text(line);
    doc.fillColor('black');

    for (const section of sections) {
      doc.moveDown(1).font('Helvetica-Bold').fontSize(13).text(section.title);
      doc.moveDown(0.3).font('Helvetica').fontSize(10.5);
      for (const line of section.lines) doc.text(line, { paragraphGap: 3 });
    }

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

await mkdir(samplesDir, { recursive: true });

// 1) Currículo "bem comportado": nome no topo, e-mail e telefone com rótulo.
await writePdf(
  'curriculo-ficticio.pdf',
  [
    'Mariana Costa Albuquerque',
    'Desenvolvedora Full Stack',
    'E-mail: mariana.albuquerque@exemplo.com.br  |  Celular: (41) 98765-4321',
    'Curitiba - PR  |  linkedin.com/in/mariana-exemplo',
  ],
  [
    {
      title: 'Resumo profissional',
      lines: [
        'Desenvolvedora com 6 anos de experiência em aplicações web com React, Node.js e SQL Server.',
        'Atuação em times ágeis, integração de APIs REST e melhoria de performance de consultas.',
      ],
    },
    {
      title: 'Experiência',
      lines: [
        'Empresa Fictícia de Software Ltda. — Desenvolvedora Pleno (2021 - 2025)',
        'Sistema de gestão de matrículas; redução de 40% no tempo de carregamento das listagens.',
        'Agência Exemplo Digital — Desenvolvedora Júnior (2019 - 2021)',
      ],
    },
    {
      title: 'Formação',
      lines: ['Análise e Desenvolvimento de Sistemas — Faculdade Exemplo (2016 - 2019)'],
    },
  ],
);

// 2) Formato diferente: nome em maiúsculas, sem telefone, e-mail sem rótulo.
await writePdf(
  'curriculo-sem-telefone.pdf',
  ['JOÃO PEDRO DOS SANTOS', 'joao.santos@exemplo.com', 'Analista de Dados'],
  [
    {
      title: 'Objetivo',
      lines: ['Atuar como analista de dados júnior.'],
    },
    {
      title: 'Experiência',
      lines: ['Estágio em BI — Empresa Fictícia S.A. (02/2023 - 12/2024)'],
    },
  ],
);

// 3) Arquivo com extensão .pdf, mas que não é PDF (para testar a validação).
await writeFile(path.join(samplesDir, 'arquivo-invalido.pdf'), 'Este arquivo não é um PDF de verdade.\n');

console.log(`Exemplos gerados em ${samplesDir}`);
