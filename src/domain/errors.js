export class DomainError extends Error {
  constructor(a, b) {
    const isCode = (s) => typeof s === 'string' && /^[A-Z_]+$/.test(s);
    let code, message;
    if (b && isCode(b)) {
      code = b;
      message = a;
    } else if (isCode(a)) {
      code = a;
      message = b || a;
    } else {
      code = a;
      message = b || a;
    }
    super(message);
    this.code = code;
    this.name = 'DomainError';
  }
}
