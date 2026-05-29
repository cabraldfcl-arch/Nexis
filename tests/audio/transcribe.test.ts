import { describe, expect, it } from "vitest";
import {
  getConfiguredTranscriptionProvider,
  maxAudioFileSizeBytes,
  transcribeAudioFormData,
  transcribeAudioUpload,
} from "@/lib/audio/transcribe";

const validAudio = new File([new Uint8Array([1, 2, 3])], "audio.webm", { type: "audio/webm" });

describe("audio transcription bridge", () => {
  it("uses the mock provider by default", () => {
    const provider = getConfiguredTranscriptionProvider({});

    expect(provider.name).toBe("mock");
    expect(provider.storesAudioPermanently).toBe(false);
  });

  it("uses the mock provider when AUDIO_TRANSCRIPTION_PROVIDER is mock", () => {
    const provider = getConfiguredTranscriptionProvider({ AUDIO_TRANSCRIPTION_PROVIDER: "mock" });

    expect(provider.name).toBe("mock");
  });

  it("returns a mock transcript that always needs review", async () => {
    const result = await transcribeAudioUpload({ file: validAudio });

    expect(result).toEqual({
      confidence: 0,
      needsReview: true,
      provider: "mock",
      transcript: "vendi 1 Produto X por 5 reais",
    });
  });

  it("allows a configurable mock transcript from multipart form data", async () => {
    const formData = new FormData();
    formData.set("audio", validAudio);
    formData.set("mockTranscript", "  vendi 1 agua por 5 reais  ");

    await expect(transcribeAudioFormData(formData)).resolves.toMatchObject({
      needsReview: true,
      provider: "mock",
      transcript: "vendi 1 agua por 5 reais",
    });
  });

  it("rejects missing audio file", async () => {
    await expect(transcribeAudioFormData(new FormData())).rejects.toMatchObject({
      code: "MISSING_AUDIO_FILE",
      status: 400,
    });
  });

  it("rejects empty audio file", async () => {
    const formData = new FormData();
    formData.set("audio", new File([], "empty.webm", { type: "audio/webm" }));

    await expect(transcribeAudioFormData(formData)).rejects.toMatchObject({
      code: "EMPTY_AUDIO_FILE",
      status: 400,
    });
  });

  it("rejects clearly invalid file type", async () => {
    const formData = new FormData();
    formData.set("audio", new File(["not audio"], "note.txt", { type: "text/plain" }));

    await expect(transcribeAudioFormData(formData)).rejects.toMatchObject({
      code: "INVALID_AUDIO_TYPE",
      status: 415,
    });
  });

  it("rejects audio larger than the short recording limit", async () => {
    const formData = new FormData();
    formData.set(
      "audio",
      new File([new Uint8Array(maxAudioFileSizeBytes + 1)], "large.webm", { type: "audio/webm" }),
    );

    await expect(transcribeAudioFormData(formData)).rejects.toMatchObject({
      code: "AUDIO_FILE_TOO_LARGE",
      status: 413,
    });
  });

  it("does not return any confirmation or persistence signal", async () => {
    const result = await transcribeAudioUpload({ file: validAudio });

    expect(result.needsReview).toBe(true);
    expect(result).not.toHaveProperty("confirmed");
    expect(result).not.toHaveProperty("saved");
    expect(result).not.toHaveProperty("draft");
  });
});
