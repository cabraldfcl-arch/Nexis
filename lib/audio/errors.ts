export type AudioTranscriptionErrorCode =
  | "MISSING_AUDIO_FILE"
  | "EMPTY_AUDIO_FILE"
  | "AUDIO_FILE_TOO_LARGE"
  | "INVALID_AUDIO_TYPE"
  | "INVALID_MOCK_TRANSCRIPT"
  | "INVALID_TRANSCRIPTION_PROVIDER"
  | "BETKOL_CPU_NOT_CONFIGURED";

export class AudioTranscriptionError extends Error {
  constructor(
    public readonly code: AudioTranscriptionErrorCode,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AudioTranscriptionError";
  }
}
