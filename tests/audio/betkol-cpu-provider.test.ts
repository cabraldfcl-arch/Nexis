import { describe, expect, it } from "vitest";
import { BetkolCpuTranscriptionProvider } from "@/lib/audio/providers/betkol-cpu-provider";
import {
  getConfiguredTranscriptionProvider,
  transcribeAudioUpload,
} from "@/lib/audio/transcribe";

const validAudio = new File([new Uint8Array([1, 2, 3])], "audio.webm", { type: "audio/webm" });

describe("BetKol CPU transcription provider stub", () => {
  it("is selected by env but fails clearly when command is missing", async () => {
    const provider = getConfiguredTranscriptionProvider({
      AUDIO_TRANSCRIPTION_PROVIDER: "betkol-cpu",
      BETKOL_CPU_COMMAND: "",
    });

    expect(provider.name).toBe("betkol-cpu");
    await expect(transcribeAudioUpload({ file: validAudio }, provider)).rejects.toMatchObject({
      code: "BETKOL_CPU_NOT_CONFIGURED",
      status: 503,
      message: "BetKol CPU ainda não configurado.",
    });
  });

  it("does not store audio permanently in the current stub", () => {
    const provider = new BetkolCpuTranscriptionProvider({ command: "", timeoutMs: 10_000 });

    expect(provider.storesAudioPermanently).toBe(false);
  });

  it("does not return confirmation or persistence data", async () => {
    const provider = new BetkolCpuTranscriptionProvider({ command: "", timeoutMs: 10_000 });

    await expect(transcribeAudioUpload({ file: validAudio }, provider)).rejects.toMatchObject({
      code: "BETKOL_CPU_NOT_CONFIGURED",
      status: 503,
    });
  });
});
