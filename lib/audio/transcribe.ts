import { AudioTranscriptionError } from "./errors";
import { BetkolCpuTranscriptionProvider } from "./providers/betkol-cpu-provider";
import type {
  AudioTranscriptionInput,
  AudioTranscriptionResult,
  TranscriptionProvider,
  TranscriptionProviderName,
} from "./types";

export { AudioTranscriptionError } from "./errors";

export const maxAudioFileSizeBytes = 5 * 1024 * 1024;

export const acceptedAudioMimeTypes = new Set([
  "audio/aac",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/x-wav",
]);

const defaultMockTranscript = "vendi 1 Produto X por 5 reais";

export const mockTranscriptionProvider: TranscriptionProvider = {
  name: "mock",
  storesAudioPermanently: false,
  async transcribe(input: AudioTranscriptionInput): Promise<AudioTranscriptionResult> {
    return {
      confidence: 0,
      needsReview: true,
      provider: this.name,
      transcript: normalizeMockTranscript(input.mockTranscript),
    };
  },
};

export type TranscriptionProviderEnv = Partial<
  Record<"AUDIO_TRANSCRIPTION_PROVIDER" | "BETKOL_CPU_COMMAND" | "BETKOL_CPU_TIMEOUT_MS", string>
>;

export function getConfiguredTranscriptionProvider(
  env: TranscriptionProviderEnv = readProcessTranscriptionProviderEnv(),
): TranscriptionProvider {
  const providerName = normalizeProviderName(env.AUDIO_TRANSCRIPTION_PROVIDER);

  if (providerName === "mock") {
    return mockTranscriptionProvider;
  }

  if (providerName === "betkol-cpu") {
    return new BetkolCpuTranscriptionProvider({
      command: env.BETKOL_CPU_COMMAND,
      timeoutMs: parseTimeoutMs(env.BETKOL_CPU_TIMEOUT_MS),
    });
  }

  throw new AudioTranscriptionError(
    "INVALID_TRANSCRIPTION_PROVIDER",
    "Provider de transcrição inválido.",
    500,
  );
}

export async function transcribeAudioFormData(
  formData: FormData,
  provider: TranscriptionProvider = getConfiguredTranscriptionProvider(),
): Promise<AudioTranscriptionResult> {
  const file = readAudioFile(formData);
  const mockTranscript = readOptionalText(formData.get("mockTranscript"));

  return transcribeAudioUpload({ file, mockTranscript }, provider);
}

export async function transcribeAudioUpload(
  input: AudioTranscriptionInput,
  provider: TranscriptionProvider = getConfiguredTranscriptionProvider(),
): Promise<AudioTranscriptionResult> {
  validateAudioFile(input.file);

  return provider.transcribe(input);
}

function normalizeProviderName(value: string | undefined): TranscriptionProviderName | "invalid" {
  const normalized = value?.trim() || "mock";

  if (normalized === "mock" || normalized === "betkol-cpu") {
    return normalized;
  }

  return "invalid";
}

function readProcessTranscriptionProviderEnv(): TranscriptionProviderEnv {
  return {
    AUDIO_TRANSCRIPTION_PROVIDER: process.env.AUDIO_TRANSCRIPTION_PROVIDER,
    BETKOL_CPU_COMMAND: process.env.BETKOL_CPU_COMMAND,
    BETKOL_CPU_TIMEOUT_MS: process.env.BETKOL_CPU_TIMEOUT_MS,
  };
}

function parseTimeoutMs(value: string | undefined): number {
  const fallback = 10_000;

  if (!value?.trim()) {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readAudioFile(formData: FormData): File {
  const value = formData.get("audio");

  if (!(value instanceof File)) {
    throw new AudioTranscriptionError(
      "MISSING_AUDIO_FILE",
      "Envie um arquivo de áudio para transcrever.",
      400,
    );
  }

  return value;
}

function validateAudioFile(file: File): void {
  if (file.size <= 0) {
    throw new AudioTranscriptionError("EMPTY_AUDIO_FILE", "O arquivo de áudio está vazio.", 400);
  }

  if (file.size > maxAudioFileSizeBytes) {
    throw new AudioTranscriptionError(
      "AUDIO_FILE_TOO_LARGE",
      "O áudio é grande demais. Grave um áudio curto de até 20 segundos.",
      413,
    );
  }

  if (!acceptedAudioMimeTypes.has(file.type)) {
    throw new AudioTranscriptionError(
      "INVALID_AUDIO_TYPE",
      "Envie um arquivo de áudio válido.",
      415,
    );
  }
}

function readOptionalText(value: FormDataEntryValue | null): string | null {
  if (value === null || value instanceof File) {
    return null;
  }

  return value;
}

function normalizeMockTranscript(value: string | null | undefined): string {
  const transcript = value?.trim() ?? "";

  if (transcript.length > 500) {
    throw new AudioTranscriptionError(
      "INVALID_MOCK_TRANSCRIPT",
      "A transcrição mock precisa ter no máximo 500 caracteres.",
      400,
    );
  }

  return transcript.length > 0 ? transcript : defaultMockTranscript;
}
