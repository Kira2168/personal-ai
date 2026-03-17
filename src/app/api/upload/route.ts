import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename') || 'file.txt';

    // 1. Get the file buffer
    const arrayBuffer = await request.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 2. Save to local storage
    const uploadPath = path.join(process.cwd(), 'public/uploads', filename);
    await writeFile(uploadPath, buffer);
    
    // 3. Return a clean JSON response
    return NextResponse.json({ success: true, url: `/uploads/${filename}` });
    
  } catch (error) {
    console.error('API Error:', error);
    // Return a JSON error so the frontend doesn't crash
    return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 });
  }
}