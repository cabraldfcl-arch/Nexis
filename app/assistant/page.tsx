import { ArrowLeft, BotMessageSquare } from "lucide-react";
import Link from "next/link";
import { ChatThread } from "@/components/assistant/chat-thread";

export const dynamic = "force-dynamic";

export default function AssistantPage() {
  const audioInputEnabled = process.env.NEXT_PUBLIC_AUDIO_INPUT_ENABLED === "true";

  return (
    <main className="h-dvh overflow-hidden bg-[#f6f7f4] text-zinc-950">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col px-3 pt-3 sm:px-6 sm:pt-5 lg:px-8">
        <header className="shrink-0 border-b border-zinc-200 pb-3">
          <Link
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            href="/"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Voltar ao painel
          </Link>
          <div className="mt-3 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
              <BotMessageSquare aria-hidden="true" className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">NEXIS</p>
              <h1 className="mt-1 text-xl font-semibold tracking-normal text-zinc-950 sm:text-2xl">
                Falar com NEXIS
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-5 text-zinc-600">
                {audioInputEnabled
                  ? "Chat por texto com áudio experimental. A transcrição vira texto antes de qualquer ação."
                  : "Demo por texto. Perguntas e lançamentos viram respostas ou rascunhos antes de salvar."}
              </p>
            </div>
          </div>
        </header>

        <section className="flex min-h-0 flex-1 flex-col pt-3" aria-labelledby="assistant-chat-heading">
          <h2 id="assistant-chat-heading" className="sr-only">
            Chat texto
          </h2>
          <ChatThread audioInputEnabled={audioInputEnabled} />
        </section>
      </div>
    </main>
  );
}
