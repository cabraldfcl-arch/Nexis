import {
  AudioTranscriptionError,
  transcribeAudioFormData,
} from "@/lib/audio/transcribe";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return Response.json(
      {
        error: {
          code: "INVALID_CONTENT_TYPE",
          message: "Envie o áudio usando multipart/form-data.",
        },
      },
      { status: 415 },
    );
  }

  try {
    const formData = await request.formData();
    const result = await transcribeAudioFormData(formData);

    return Response.json(result);
  } catch (error) {
    if (error instanceof AudioTranscriptionError) {
      return Response.json(
        {
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: error.status },
      );
    }

    return Response.json(
      {
        error: {
          code: "TRANSCRIPTION_FAILED",
          message: "Não foi possível transcrever o áudio agora.",
        },
      },
      { status: 500 },
    );
  }
}
