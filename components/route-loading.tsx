type RouteLoadingProps = {
  title: string;
  description: string;
  showBackAction?: boolean;
  listLabel?: string;
};

export function RouteLoading({ title, description, showBackAction = true, listLabel = "Carregando dados" }: RouteLoadingProps) {
  return (
    <main className="min-h-dvh bg-[#f6f7f4] text-zinc-950">
      <div
        aria-busy="true"
        aria-live="polite"
        className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 py-5 sm:px-6 lg:px-8"
        role="status"
      >
        <header className="border-b border-zinc-200 pb-5">
          {showBackAction ? <div className="h-11 w-40 rounded-lg border border-zinc-200 bg-white shadow-sm" /> : null}
          <div className={`${showBackAction ? "mt-5" : ""} flex items-start gap-3`}>
            <div className="h-11 w-11 shrink-0 rounded-lg bg-emerald-100" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold uppercase tracking-normal text-emerald-700">Carregando</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-normal text-zinc-950">{title}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">{description}</p>
            </div>
          </div>
        </header>

        <section className="py-5">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="h-5 w-36 rounded bg-zinc-200" />
            <div className="mt-4 grid gap-3">
              <div className="h-12 rounded-lg bg-zinc-100" />
              <div className="h-12 rounded-lg bg-zinc-100" />
              <div className="h-12 rounded-lg bg-zinc-100" />
            </div>
          </div>
        </section>

        <section className="pb-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-normal text-zinc-950">{listLabel}</h2>
            <div className="h-6 w-14 rounded-full bg-zinc-200" />
          </div>
          <div className="grid gap-3">
            <div className="h-28 rounded-lg border border-zinc-200 bg-white shadow-sm" />
            <div className="h-28 rounded-lg border border-zinc-200 bg-white shadow-sm" />
          </div>
        </section>
      </div>
    </main>
  );
}
