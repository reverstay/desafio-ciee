import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { MAX_PDF_SIZE_BYTES } from '@curriculos/shared';
import { AppError } from '../errors.js';
import { parseResume } from './parse-resume.js';

export type PdfTextExtractor = (buffer: Buffer) => Promise<string>;

const PDF_SIGNATURE = Buffer.from('%PDF-');

// O arquivo fica só em memória: é lido, analisado e descartado.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PDF_SIZE_BYTES, files: 1 },
}).single('file');

/** Traduz os erros do multer em mensagens para o usuário. */
const handleUpload: RequestHandler = (req, res, next) => {
  upload(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError(413, 'O arquivo excede o limite de 5 MB.', 'FILE_TOO_LARGE'));
      }
      return next(new AppError(400, 'Envie um único arquivo PDF no campo "file".', 'INVALID_UPLOAD'));
    }
    next(err);
  });
};

export function resumesRouter(extractText: PdfTextExtractor): Router {
  const router = Router();

  router.post('/extract', handleUpload, async (req, res) => {
    const file = req.file;
    if (!file || file.size === 0) {
      throw new AppError(400, 'Selecione um arquivo PDF para importar.', 'FILE_REQUIRED');
    }

    // Confere a assinatura do arquivo, não apenas a extensão ou o tipo informado pelo navegador.
    const isPdf = file.buffer.subarray(0, 1024).includes(PDF_SIGNATURE);
    if (!isPdf) {
      throw new AppError(415, 'Arquivo inválido. Envie um currículo em formato PDF.', 'INVALID_FILE_TYPE');
    }

    let text: string;
    try {
      text = await extractText(file.buffer);
    } catch {
      throw new AppError(
        422,
        'Não foi possível ler o PDF. O arquivo pode estar corrompido ou protegido por senha. Preencha os dados manualmente.',
        'PDF_READ_FAILED',
      );
    }

    if (!text.trim()) {
      throw new AppError(
        422,
        'O PDF não contém texto selecionável (pode ser uma imagem digitalizada). Preencha os dados manualmente.',
        'PDF_NO_TEXT',
      );
    }

    res.json(parseResume(text));
  });

  return router;
}
