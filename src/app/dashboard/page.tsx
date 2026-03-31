'use client';

import { useState } from 'react';
import Image from 'next/image';

export default function Dashboard() {
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState('');

  async function handleUpload() {
    if (!selectedFiles || selectedFiles.length === 0) {
      setStatus('Please choose at least one file first.');
      return;
    }

    setIsUploading(true);
    setStatus('Uploading and extracting text...');

    try {
      for (const file of Array.from(selectedFiles)) {
        const encodedName = encodeURIComponent(file.name);
        const response = await fetch(`/api/upload?filename=${encodedName}`, {
          method: 'POST',
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
          },
          body: await file.arrayBuffer(),
        });

        if (!response.ok) {
          throw new Error(`Upload failed for ${file.name}`);
        }
      }

      setStatus('Knowledge synced successfully. Your chat can now answer from these files.');
      setSelectedFiles(null);
    } catch (error) {
      console.error(error);
      setStatus('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-5 pt-4 sm:px-8 sm:pb-7 sm:pt-6">
      <header className="glass-card mb-5 rounded-3xl px-5 py-4 sm:mb-6 sm:px-6 sm:py-5">
        <p className="chat-kicker text-xs uppercase tracking-[0.24em]">Workspace</p>
        <h1 className="chat-title mt-2 text-2xl font-bold sm:text-4xl">Kirubel Personal AI Dashboard</h1>
        <p className="dash-subtle mt-2 text-sm leading-relaxed">Upload knowledge, monitor system health, and keep your private brain synchronized.</p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3">
        <div className="glass-card dash-card md:col-span-2 rounded-3xl p-5 sm:p-6">
          <h2 className="display-heading text-xl font-semibold">Upload Knowledge</h2>
          <p className="dash-subtle mt-2 text-sm">
            Upload TXT, PDF, or DOCX files to expand your assistant&apos;s memory context.
          </p>
          <input
            type="file"
            multiple
            accept=".txt,.pdf,.docx"
            className="upload-input mt-5 block w-full text-sm"
            onChange={event => setSelectedFiles(event.target.files)}
          />
          <button
            onClick={handleUpload}
            disabled={isUploading}
            className="send-button mt-6 w-full rounded-xl py-3 font-bold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUploading ? 'Syncing...' : 'Sync to Brain'}
          </button>
          {status ? <p className="dash-subtle mt-3 text-sm">{status}</p> : null}
        </div>

        <div className="glass-card dash-card flex flex-col items-center justify-center rounded-3xl p-5 sm:p-6">
          <Image
            src="/me.jpg"
            alt="Kirubel"
            width={84}
            height={84}
            className="h-20 w-20 rounded-full border border-white/20 object-cover"
          />
          <p className="dash-subtle mt-3">Identity Profile</p>
          <p className="status-pill mt-2 rounded-full px-3 py-1 text-sm font-semibold">Loaded</p>
        </div>
      </div>
    </section>
  );
}