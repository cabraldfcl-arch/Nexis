import { AudioTranscriptionError } from "../errors";
import type { AudioTranscriptionResult, TranscriptionProvider } from "../types";

export type BetkolCpuProviderConfig = {
  command?: string | null;
  timeoutMs?: number;
};

export class BetkolCpuTranscriptionProvider implements TranscriptionProvider {
  readonly name = "betkol-cpu";
  readonly storesAudioPermanently = false;
  readonly command: string;
  readonly timeoutMs: number;

  constructor(config: BetkolCpuProviderConfig) {
    this.command = config.command?.trim() ?? "";
    this.timeoutMs = config.timeoutMs ?? 10_000;
  }

  async transcribe(): Promise<AudioTranscriptionResult> {
    throw new AudioTranscriptionError(
      "BETKOL_CPU_NOT_CONFIGURED",
      "BetKol CPU ainda não configurado.",
      503,
    );
  }
}
