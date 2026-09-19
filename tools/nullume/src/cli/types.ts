export interface CommandFlags {
  json?: boolean;
  quiet?: boolean;
}

export interface EmitPayload {
  message?: string;
  data?: unknown;
  success?: boolean;
}
