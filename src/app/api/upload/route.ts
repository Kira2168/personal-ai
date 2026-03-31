import { NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function extractTextFromBuffer(buffer: Buffer, extension: string) {
  if (extension === '.txt') {
    return buffer.toString('utf-8');
  }

  if (extension === '.pdf') {
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    await parser.destroy();
    return parsed.text ?? '';
  }

  if (extension === '.docx') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value ?? '';
  }

  return '';
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawFilename = searchParams.get('filename') || 'file.txt';
    const filename = sanitizeFilename(rawFilename);
    const extension = path.extname(filename).toLowerCase();

    // 1. Get the file buffer
    const arrayBuffer = await request.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 2. Save to local storage
    const uploadDir = path.join(process.cwd(), 'public/uploads');
    await mkdir(uploadDir, { recursive: true });
    const uploadPath = path.join(uploadDir, filename);
    await writeFile(uploadPath, buffer);

    // 3. Extract searchable text for TXT/PDF/DOCX and save it as .txt.
    const extractedText = await extractTextFromBuffer(buffer, extension);
    const supportedTextSource = extension === '.txt' || extension === '.pdf' || extension === '.docx';

    if (supportedTextSource && extractedText.trim().length > 0) {
      const txtFilename = `${path.parse(filename).name}.txt`;
      const textPath = path.join(uploadDir, txtFilename);
      await writeFile(textPath, extractedText, 'utf-8');
    }
    
    // 4. Return a clean JSON response
    return NextResponse.json({ success: true, url: `/uploads/${filename}` });
    
  } catch (error) {
    console.error('API Error:', error);
    // Return a JSON error so the frontend doesn't crash
    return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 });
  }
}