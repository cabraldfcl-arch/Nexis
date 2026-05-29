"use client";

import { SendHorizontal } from "lucide-react";
import type { FormEvent, KeyboardEvent } from "react";
import { useRef, useState } from "react";
import { AudioRecorder } from "./audio-recorder";

type MessageInputProps = {
  audioInputEnabled: boolean;
  onSend: (message: string) => Promise<void>;
  pending: boolean;
};

export function MessageInput({ audioInputEnabled, onSend, pending }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedMessage = message.trim();

    if (trimmedMessage.length === 0 || pending) {
      return;
    }

    await onSend(trimmedMessage);
    setMessage("");
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  return (
    <form className="rounded-lg border border-zinc-200 bg-white p-2 shadow-sm" onSubmit={handleSubmit}>
      {audioInputEnabled ? (
        <AudioRecorder onTranscript={setMessage} />
      ) : (
        <section aria-label="Modo texto-only" className="mb-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
          <p className="text-sm font-semibold text-sky-950">Demo por texto</p>
          <p className="mt-1 text-xs leading-5 text-sky-900 sm:text-sm">
            Digite perguntas ou lançamentos. Nada é salvo sem confirmação.
          </p>
        </section>
      )}

      <label className="sr-only" htmlFor="assistant-message">
        Mensagem
      </label>
      <div className="flex items-end gap-2">
        <textarea
          className="min-h-12 max-h-32 flex-1 resize-none rounded-lg border border-zinc-300 bg-white px-3 py-3 text-base font-medium leading-6 text-zinc-950 shadow-sm placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          id="assistant-message"
          name="message"
          onKeyDown={handleKeyDown}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Digite sua mensagem"
          ref={textareaRef}
          rows={1}
          value={message}
        />
        <button
          aria-label="Enviar para NEXIS"
          className="flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-400 sm:min-w-28 sm:px-4"
          disabled={pending}
          type="submit"
        >
          <SendHorizontal aria-hidden="true" className="h-5 w-5" />
          <span className="hidden sm:inline">{pending ? "Analisando" : "Enviar"}</span>
        </button>
      </div>
    </form>
  );
}
