"use client";

import { Mic, Square } from "lucide-react";
import { useRef, useState } from "react";

type AudioRecorderProps = {
  onTranscript: (transcript: string) => void;
};

type RecorderStatus = "idle" | "recording" | "transcribing" | "ready" | "error";

const maxRecordingMs = 20_000;
const maxRecordingSeconds = maxRecordingMs / 1000;
const supportedRecorderTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

export function AudioRecorder({ onTranscript }: AudioRecorderProps) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [message, setMessage] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recording = status === "recording";
  const transcribing = status === "transcribing";

  async function startRecording() {
    setMessage("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setMessage("Este navegador não permite gravar áudio aqui.");
      return;
    }

    if (typeof MediaRecorder === "undefined") {
      setStatus("error");
      setMessage("Este navegador não tem suporte a gravação de áudio.");
      return;
    }

    const mimeType = selectRecorderMimeType();

    if (!mimeType) {
      setStatus("error");
      setMessage("Este navegador não oferece um formato de áudio aceito.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType });

      chunksRef.current = [];
      streamRef.current = stream;
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        void transcribeRecording(mimeType);
      };
      recorder.onerror = () => {
        cleanupRecorder();
        setStatus("error");
        setMessage("Não foi possível concluir a gravação.");
      };

      recorder.start();
      setStatus("recording");
      setMessage(`Gravando... limite de ${maxRecordingSeconds} segundos.`);
      timeoutRef.current = setTimeout(() => {
        stopRecording();
      }, maxRecordingMs);
    } catch (error) {
      cleanupRecorder();
      setStatus("error");
      setMessage(userFacingRecorderError(error));
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }

  async function transcribeRecording(mimeType: string) {
    const chunks = chunksRef.current;

    cleanupRecorder();

    if (chunks.length === 0) {
      setStatus("error");
      setMessage("Nenhum áudio foi capturado.");
      return;
    }

    try {
      setStatus("transcribing");
      setMessage("Transcrevendo áudio experimental...");

      const audio = new Blob(chunks, { type: baseMimeType(mimeType) });
      const formData = new FormData();
      formData.set("audio", audio, "nexis-audio.webm");

      const response = await fetch("/api/audio/transcribe", {
        body: formData,
        method: "POST",
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(readTranscriptionError(body));
      }

      if (!body || typeof body.transcript !== "string") {
        throw new Error("A transcrição voltou em formato inválido.");
      }

      onTranscript(body.transcript);
      setStatus("ready");
      setMessage("Transcrição pronta no campo de texto. Revise antes de enviar.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Não foi possível transcrever o áudio.");
    }
  }

  function cleanupRecorder(): void {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }

  return (
    <section
      aria-labelledby="audio-recorder-heading"
      className="rounded-lg border border-emerald-200 bg-emerald-50 p-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="audio-recorder-heading" className="text-sm font-semibold text-emerald-950">
            Áudio experimental
          </h3>
          <p className="mt-1 text-sm leading-6 text-emerald-900">
            A transcrição vira texto. Você ainda precisa confirmar antes de salvar.
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
          disabled={recording || transcribing}
          onClick={() => void startRecording()}
          type="button"
        >
          <Mic aria-hidden="true" className="h-4 w-4" />
          Gravar áudio
        </button>
        <button
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 shadow-sm transition hover:border-rose-300 hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
          disabled={!recording}
          onClick={stopRecording}
          type="button"
        >
          <Square aria-hidden="true" className="h-4 w-4" />
          Parar
        </button>
      </div>

      {message ? (
        <p className={`mt-3 rounded-lg border px-3 py-2 text-sm font-semibold ${messageTone(status)}`}>
          {message}
        </p>
      ) : null}
    </section>
  );
}

function selectRecorderMimeType(): string | null {
  return supportedRecorderTypes.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

function baseMimeType(value: string): string {
  return value.split(";")[0] ?? value;
}

function userFacingRecorderError(error: unknown): string {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Permita o microfone no navegador para gravar áudio.";
  }

  return "Não foi possível acessar o microfone.";
}

function readTranscriptionError(body: unknown): string {
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    body.error &&
    typeof body.error === "object" &&
    "message" in body.error &&
    typeof body.error.message === "string"
  ) {
    return body.error.message;
  }

  return "Não foi possível transcrever o áudio.";
}

function messageTone(status: RecorderStatus): string {
  if (status === "error") {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }

  return "border-emerald-200 bg-white text-emerald-900";
}
