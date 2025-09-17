// /packages/demo_services/media_demo/constants.ts
export const MEDIA_DEMO_VERSION = "1.0.0" as const;

export const MEDIA_DEMO_MESSAGES = {
	en: {
		welcome: "Welcome to Media Demo! Choose a media type:",
		audio: "Here's an audio file",
		video: "Here's a video file",
		document: "Here's a document",
		location: "Here's a location in {{city}}",
		contact: "Here's a contact: {{name}}",
		unknownType: "Unknown media type",
	},
	es: {
		welcome: "¡Bienvenido a Media Demo! Elige un tipo de medios:",
		audio: "Aquí tienes un archivo de audio",
		video: "Aquí tienes un archivo de video",
		document: "Aquí tienes un documento",
		location: "Aquí tienes una ubicación en {{city}}",
		contact: "Aquí tienes un contacto: {{name}}",
		unknownType: "Tipo de medios desconocido",
	},
};
