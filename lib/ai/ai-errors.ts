export type AiAssistantErrorCode =
  | "AI_ASSISTANT_NOT_CONFIGURED"
  | "AI_ASSISTANT_HTTP_ERROR"
  | "AI_ASSISTANT_INVALID_RESPONSE"
  | "AI_ASSISTANT_TIMEOUT";

export class AiAssistantError extends Error {
  readonly code: AiAssistantErrorCode;
  readonly cause?: unknown;

  constructor(code: AiAssistantErrorCode, message: string, options: { cause?: unknown } = {}) {
    super(message);
    this.name = "AiAssistantError";
    this.code = code;
    this.cause = options.cause;
  }
}
