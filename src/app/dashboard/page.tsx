'use client';

export default function Dashboard() {
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
          <p className="dash-subtle mt-2 text-sm">Drop TXT files to expand your assistant's memory context.</p>
          <input type="file" className="upload-input mt-5 block w-full text-sm" />
          <button className="send-button mt-6 w-full rounded-xl py-3 font-bold">Sync to Brain</button>
        </div>

        <div className="glass-card dash-card flex flex-col items-center justify-center rounded-3xl p-5 sm:p-6">
          <span className="text-5xl">🧠</span>
          <p className="dash-subtle mt-3">Brain Status</p>
          <p className="status-pill mt-2 rounded-full px-3 py-1 text-sm font-semibold">Online</p>
        </div>
      </div>
    </section>
  );
}