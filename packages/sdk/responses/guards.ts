// sdk/responses/guards.ts
import type {
	AudioMessage,
	DocumentMessage,
	PhotoMessage,
	ReplyMessage,
	ServiceResponse,
	UIMessage,
	VideoMessage,
} from "./types.ts";

export const isReply = (r: ServiceResponse): r is ReplyMessage => r.kind === "reply";
export const isError = (r: ServiceResponse): r is { kind: "error" } => r.kind === "error";
export const isNone = (r: ServiceResponse): r is { kind: "none" } => r.kind === "none";
export const isPhoto = (r: ServiceResponse): r is PhotoMessage => r.kind === "photo";
export const isAudio = (r: ServiceResponse): r is AudioMessage => r.kind === "audio";
export const isVideo = (r: ServiceResponse): r is VideoMessage => r.kind === "video";
export const isDocument = (r: ServiceResponse): r is DocumentMessage => r.kind === "document";
export const isUI = (r: ServiceResponse): r is UIMessage => r.kind === "ui";
export const isMedia = (
	r: ServiceResponse,
): r is PhotoMessage | AudioMessage | VideoMessage | DocumentMessage =>
	["photo", "audio", "video", "document"].includes(r.kind);
