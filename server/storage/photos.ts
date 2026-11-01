import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppError } from '../http.ts';

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const MAX_PDF_BYTES = 25 * 1024 * 1024;

const PHOTO_SIGNATURES: { ext: string; test: (b: Uint8Array) => boolean }[] = [
  { ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'png', test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { ext: 'webp', test: (b) => ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP' },
];

const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.slice(from, to));

export class FileStore {
  constructor(private readonly rootDir: string) {}

  // O tipo vem do conteúdo do arquivo, não do nome nem do cabeçalho enviado pelo cliente.
  async savePhoto(file: File): Promise<string> {
    if (file.size > MAX_PHOTO_BYTES) {
      throw new AppError(413, 'FILE_TOO_LARGE', 'A foto deve ter no máximo 8 MB.');
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = PHOTO_SIGNATURES.find((s) => s.test(bytes));
    if (!kind) throw new AppError(415, 'INVALID_FILE_TYPE', 'Envie fotos em JPG, PNG ou WEBP.');
    return this.write('photos', `${randomUUID()}.${kind.ext}`, bytes);
  }

  async savePdf(file: File): Promise<string> {
    if (file.size > MAX_PDF_BYTES) {
      throw new AppError(413, 'FILE_TOO_LARGE', 'O PDF deve ter no máximo 25 MB.');
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (ascii(bytes, 0, 5) !== '%PDF-') throw new AppError(415, 'INVALID_FILE_TYPE', 'Envie um arquivo PDF.');
    return this.write('documents', `${randomUUID()}.pdf`, bytes);
  }

  remove(publicPath: string): void {
    if (!publicPath.startsWith('/uploads/')) return;
    rmSync(join(this.rootDir, publicPath.slice('/uploads/'.length)), { force: true });
  }

  protected write(folder: string, name: string, bytes: Uint8Array): string {
    const dir = join(this.rootDir, folder);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, name), bytes);
    return `/uploads/${folder}/${name}`;
  }
}
