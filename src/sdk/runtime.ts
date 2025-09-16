// sdk/runtime.ts
// Public service runtime & helper primitives.
// (Inlined from deprecated pbb_sdk/runtime.ts to remove legacy directory.)

export type ServiceKind = "single_command" | "command_flow" | "listener";

export interface StateDirectiveClear {
	op: "clear";
}
export interface StateDirectiveReplace {
	op: "replace";
	value: Record<string, unknown>;
}
export interface StateDirectiveMerge {
	op: "merge";
	value: Record<string, unknown>;
}
export type StateDirective = StateDirectiveClear | StateDirectiveReplace | StateDirectiveMerge;

export interface BaseReply {
	kind: string;
	text?: string;
	options?: Record<string, unknown>;
	state?: StateDirective;
	deleteTrigger?: boolean;
}
export interface ReplyMessage extends BaseReply {
	kind: "reply";
}
export interface EditMessage extends BaseReply {
	kind: "edit";
}
export interface NoneMessage extends BaseReply {
	kind: "none";
}
export interface ErrorMessage extends BaseReply {
	kind: "error";
}
export interface PhotoMessage extends BaseReply {
	kind: "photo";
	photo: string;
	caption?: string;
}
export interface DeleteMessage extends BaseReply {
	kind: "delete";
}
export interface AudioMessage extends BaseReply {
	kind: "audio";
	audio: string;
	duration?: number;
	title?: string;
	performer?: string;
}
export interface VideoMessage extends BaseReply {
	kind: "video";
	video: string;
	duration?: number;
	width?: number;
	height?: number;
	thumbnail?: string;
}
export interface DocumentMessage extends BaseReply {
	kind: "document";
	document: string;
	filename?: string;
	mimeType?: string;
}
export interface LocationMessage extends BaseReply {
	kind: "location";
	latitude: number;
	longitude: number;
	title?: string;
	address?: string;
}
export interface ContactMessage extends BaseReply {
	kind: "contact";
	phoneNumber: string;
	firstName: string;
	lastName?: string;
	userId?: string;
}
export interface UIMessage extends BaseReply {
	kind: "ui";
	ui:
		| import("./ui.ts").UIKeyboard
		| import("./ui.ts").UIMenu
		| import("./ui.ts").UICard
		| import("./ui.ts").UICarousel;
	uiType: "keyboard" | "menu" | "card" | "carousel";
}
export type ServiceResponse =
	| ReplyMessage
	| EditMessage
	| NoneMessage
	| ErrorMessage
	| PhotoMessage
	| DeleteMessage
	| AudioMessage
	| VideoMessage
	| DocumentMessage
	| LocationMessage
	| ContactMessage
	| UIMessage;

export interface ServiceContext {
	chatId: string;
	userId: string;
	language?: string;
	serviceConfig?: Record<string, unknown>;
	state?: Record<string, unknown>;
	stateVersion?: number;
	t?: (key: string, params?: Record<string, unknown>) => string;
}

export type CommandEvent = { type: "command" } & ServiceContext;
export type CallbackEvent = { type: "callback"; data: string } & ServiceContext;
export type MessageEvent = { type: "message"; message: unknown } & ServiceContext;
export type GenericEvent = CommandEvent | CallbackEvent | MessageEvent;

export interface ServiceDefinition {
	id: string;
	version: string;
	kind: ServiceKind;
	command: string; // canonical token (without leading /)
	description?: string;
	handlers: {
		command: (ev: CommandEvent) => ServiceResponse | Promise<ServiceResponse>;
		callback: (ev: CallbackEvent) => ServiceResponse | Promise<ServiceResponse>;
		message: (ev: MessageEvent) => ServiceResponse | Promise<ServiceResponse>;
	};
}

export interface ServiceManifest {
	id: string;
	version: string;
	kind: ServiceKind;
	command: string;
	description?: string;
	schemaVersion: number;
}

export interface DefinedService extends ServiceDefinition {
	manifest: ServiceManifest;
}

export const SERVICE_SDK_SCHEMA_VERSION = 1 as const;

export function defineService(def: ServiceDefinition): DefinedService {
	const manifest: ServiceManifest = {
		id: def.id,
		version: def.version,
		kind: def.kind,
		command: def.command,
		description: def.description,
		schemaVersion: SERVICE_SDK_SCHEMA_VERSION,
	};
	return Object.freeze({ ...def, manifest, handlers: def.handlers });
}

export function reply(
	text: string,
	opts?: { options?: Record<string, unknown>; state?: StateDirective; deleteTrigger?: boolean },
): ReplyMessage {
	return {
		kind: "reply",
		text,
		options: opts?.options,
		state: opts?.state,
		deleteTrigger: opts?.deleteTrigger,
	};
}
export function edit(
	text: string,
	opts?: { options?: Record<string, unknown>; state?: StateDirective; deleteTrigger?: boolean },
): EditMessage {
	return {
		kind: "edit",
		text,
		options: opts?.options,
		state: opts?.state,
		deleteTrigger: opts?.deleteTrigger,
	};
}
export function none(): NoneMessage {
	return { kind: "none" };
}
export function error(text: string): ErrorMessage {
	return { kind: "error", text };
}
export function photoResp(
	photo: string,
	opts?: {
		caption?: string;
		options?: Record<string, unknown>;
		state?: StateDirective;
		deleteTrigger?: boolean;
	},
): PhotoMessage {
	return {
		kind: "photo",
		photo,
		caption: opts?.caption,
		options: opts?.options,
		state: opts?.state,
		deleteTrigger: opts?.deleteTrigger,
	};
}
export function deleteResp(): DeleteMessage {
	return { kind: "delete" };
}

export function audio(
	audio: string,
	opts?: {
		duration?: number;
		title?: string;
		performer?: string;
		options?: Record<string, unknown>;
		state?: StateDirective;
		deleteTrigger?: boolean;
	},
): AudioMessage {
	return {
		kind: "audio",
		audio,
		duration: opts?.duration,
		title: opts?.title,
		performer: opts?.performer,
		options: opts?.options,
		state: opts?.state,
		deleteTrigger: opts?.deleteTrigger,
	};
}

export function video(
	video: string,
	opts?: {
		duration?: number;
		width?: number;
		height?: number;
		thumbnail?: string;
		options?: Record<string, unknown>;
		state?: StateDirective;
		deleteTrigger?: boolean;
	},
): VideoMessage {
	return {
		kind: "video",
		video,
		duration: opts?.duration,
		width: opts?.width,
		height: opts?.height,
		thumbnail: opts?.thumbnail,
		options: opts?.options,
		state: opts?.state,
		deleteTrigger: opts?.deleteTrigger,
	};
}

export function document(
	document: string,
	opts?: {
		filename?: string;
		mimeType?: string;
		options?: Record<string, unknown>;
		state?: StateDirective;
		deleteTrigger?: boolean;
	},
): DocumentMessage {
	return {
		kind: "document",
		document,
		filename: opts?.filename,
		mimeType: opts?.mimeType,
		options: opts?.options,
		state: opts?.state,
		deleteTrigger: opts?.deleteTrigger,
	};
}

export function location(
	latitude: number,
	longitude: number,
	opts?: {
		title?: string;
		address?: string;
		options?: Record<string, unknown>;
		state?: StateDirective;
		deleteTrigger?: boolean;
	},
): LocationMessage {
	return {
		kind: "location",
		latitude,
		longitude,
		title: opts?.title,
		address: opts?.address,
		options: opts?.options,
		state: opts?.state,
		deleteTrigger: opts?.deleteTrigger,
	};
}

export function contact(
	phoneNumber: string,
	firstName: string,
	opts?: {
		lastName?: string;
		userId?: string;
		options?: Record<string, unknown>;
		state?: StateDirective;
		deleteTrigger?: boolean;
	},
): ContactMessage {
	return {
		kind: "contact",
		phoneNumber,
		firstName,
		lastName: opts?.lastName,
		userId: opts?.userId,
		options: opts?.options,
		state: opts?.state,
		deleteTrigger: opts?.deleteTrigger,
	};
}

export function ui(
	uiElement:
		| import("./ui.ts").UIKeyboard
		| import("./ui.ts").UIMenu
		| import("./ui.ts").UICard
		| import("./ui.ts").UICarousel,
	uiType: "keyboard" | "menu" | "card" | "carousel",
	text?: string,
	opts?: {
		options?: Record<string, unknown>;
		state?: StateDirective;
		deleteTrigger?: boolean;
	},
): UIMessage {
	return {
		kind: "ui",
		text,
		ui: uiElement,
		uiType,
		options: opts?.options,
		state: opts?.state,
		deleteTrigger: opts?.deleteTrigger,
	};
}

export function uiKeyboard(
	keyboard: import("./ui.ts").UIKeyboard,
	text?: string,
	opts?: {
		options?: Record<string, unknown>;
		state?: StateDirective;
		deleteTrigger?: boolean;
	},
): UIMessage {
	return ui(keyboard, "keyboard", text, opts);
}

export function uiMenu(
	menu: import("./ui.ts").UIMenu,
	text?: string,
	opts?: {
		options?: Record<string, unknown>;
		state?: StateDirective;
		deleteTrigger?: boolean;
	},
): UIMessage {
	return ui(menu, "menu", text, opts);
}

export function uiCard(
	card: import("./ui.ts").UICard,
	text?: string,
	opts?: {
		options?: Record<string, unknown>;
		state?: StateDirective;
		deleteTrigger?: boolean;
	},
): UIMessage {
	return ui(card, "card", text, opts);
}

export function uiCarousel(
	carousel: import("./ui.ts").UICarousel,
	text?: string,
	opts?: {
		options?: Record<string, unknown>;
		state?: StateDirective;
		deleteTrigger?: boolean;
	},
): UIMessage {
	return ui(carousel, "carousel", text, opts);
}


export const state = {
	replace(value: Record<string, unknown>): StateDirectiveReplace {
		return { op: "replace", value };
	},
	merge(value: Record<string, unknown>): StateDirectiveMerge {
		return { op: "merge", value };
	},
	clear(): StateDirectiveClear {
		return { op: "clear" };
	},
} as const;

// Service runtime entrypoint for sandbox.
export async function runService(svc: DefinedService) {
	const raw = await new Response(Deno.stdin.readable).text();
	const payload = JSON.parse(raw);
	const event = payload.event as GenericEvent;
	const ctxBase = {
		chatId: payload.ctx.chatId,
		userId: payload.ctx.userId,
		serviceConfig: payload.ctx.serviceConfig,
		state: event.state,
		stateVersion: event.stateVersion,
	};
	let resp: ServiceResponse | undefined;
	try {
		if (event.type === "command") {
			resp = await svc.handlers.command({ ...ctxBase, type: "command" });
		} else if (event.type === "callback") {
			resp = await svc.handlers.callback({
				...ctxBase,
				type: "callback",
				data: (event as CallbackEvent).data,
			});
		} else if (event.type === "message") {
			resp = await svc.handlers.message({
				...ctxBase,
				type: "message",
				message: (event as MessageEvent).message,
			});
		} else {
			resp = error("unknown event type");
		}
	} catch (err) {
		resp = error((err as Error).message || "service error");
	}
	await Deno.stdout.write(new TextEncoder().encode(JSON.stringify(resp)));
}

// Inline keyboard builder for Telegram and compatible adapters
export interface InlineButton {
	text: string;
	data: string;
	hide?: boolean;
}

export interface InlineKeyboardRowBuilder {
	button(btn: InlineButton): InlineKeyboardRowBuilder;
	buttons(btns: InlineButton[]): InlineKeyboardRowBuilder;
	row(): InlineKeyboardRowBuilder;
	done(): InlineKeyboardBuilder;
	build(): Record<string, unknown>;
}

export class InlineKeyboardBuilder implements InlineKeyboardRowBuilder {
	private rows: { text: string; callback_data: string }[][] = [];
	private current: { text: string; callback_data: string }[] = [];

	button(btn: InlineButton): InlineKeyboardRowBuilder {
		if (!btn.hide) this.current.push({ text: btn.text, callback_data: btn.data });
		return this;
	}
	buttons(btns: InlineButton[]): InlineKeyboardRowBuilder {
		for (const b of btns) this.button(b);
		return this;
	}
	row(): InlineKeyboardRowBuilder {
		if (this.current.length) {
			this.rows.push(this.current);
			this.current = [];
		}
		return this;
	}
	done(): InlineKeyboardBuilder {
		if (this.current.length) this.row();
		return this;
	}
	build(): Record<string, unknown> {
		this.done();
		return { inline_keyboard: this.rows };
	}
}

export function inlineKeyboard(): InlineKeyboardBuilder {
	return new InlineKeyboardBuilder();
}

// Simple i18n helper for services
export interface I18nMessages {
	[key: string]: string | I18nMessages;
}

export function createI18n(messages: I18nMessages, fallbackLang = "en") {
	return function t(key: string, params?: Record<string, unknown>, lang = fallbackLang): string {
		const keys = key.split(".");
		let current: string | I18nMessages = messages[lang] || messages[fallbackLang] || messages;

		for (const k of keys) {
			if (current && typeof current === "object" && k in current) {
				current = current[k];
			} else {
				return key; // Return key if translation not found
			}
		}

		if (typeof current !== "string") {
			return key;
		}

		// Simple parameter replacement
		if (params) {
			return current.replace(/\{\{(\w+)\}\}/g, (match, param) => {
				return params[param]?.toString() || match;
			});
		}

		return current;
	};
}
