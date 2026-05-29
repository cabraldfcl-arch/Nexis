export type TranscriptionProviderName = "mock" | "betkol-cpu";

export type AudioTranscriptionResult = {
  transcript: string;
  confidence?: number;
  provider: TranscriptionProviderName;
  needsReview: true;
};

export type AudioTranscriptionInput = {
  file: File;
  mockTranscript?: string | null;
};

export interface TranscriptionProvider {
  name: TranscriptionProviderName;
  storesAudioPermanently: false;
  transcribe(input: AudioTranscriptionInput): Promise<AudioTranscriptionResult>;
}
