export class DomainError extends Error {
  constructor(code, message, details = {}) {
    const isCode = (value) => typeof value === 'string' && /^[A-Z_]+$/.test(value);

    let finalCode = code;
    let finalMessage = message;

    if (typeof code === 'string' && typeof message === 'string' && isCode(message) && !isCode(code)) {
      finalCode = message;
      finalMessage = code;
    }

    if (finalMessage === undefined) {
      finalMessage = finalCode ?? 'Domain error';
      finalCode = 'DOMAIN_ERROR';
    }

    super(finalMessage);
    this.name = 'DomainError';
    this.code = finalCode;
    this.details = details ?? {};
  }
}
