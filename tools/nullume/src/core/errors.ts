export class NullumeError extends Error {
  exitCode: number = 1;

  constructor(message: string, exitCode: number = 1) {
    super(message);
    this.name = "NullumeError";
    this.exitCode = exitCode;
  }
}

export class UsageError extends NullumeError {
  constructor(message: string) {
    super(message, 2);
    this.name = "UsageError";
  }
}

export class ConfigError extends NullumeError {
  constructor(message: string) {
    super(message, 1);
    this.name = "ConfigError";
  }
}

export class ProviderError extends NullumeError {
  code?: string | number;
  msg?: string;

  constructor(message: string, code?: string | number) {
    super(message, 1);
    this.name = "ProviderError";
    this.code = code;
  }
}

export class TaskNotFound extends ProviderError {
  constructor(message: string, code?: string | number) {
    super(`Задача не найдена: ${message}`, code);
    this.name = "TaskNotFound";
  }
}

export class NetworkError extends NullumeError {
  constructor(message: string) {
    super(`Ошибка сети: ${message}`, 1);
    this.name = "NetworkError";
  }
}

export class RateLimitError extends NullumeError {
  constructor(message: string) {
    super(`Превышен лимит запросов: ${message}`, 1);
    this.name = "RateLimitError";
  }
}
