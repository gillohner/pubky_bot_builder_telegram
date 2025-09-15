export const HELLO_SERVICE_ID = "mock_hello" as const;
export const HELLO_VERSION = "1.0.0" as const;
export const HELLO_COMMAND = "hello" as const;
export const HELLO_DEFAULT_GREETING = "Hello from sandbox!" as const;

export interface HelloConfig {
	greeting?: string;
}
