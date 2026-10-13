export class PlayError extends Error {
  constructor(code, message, status = 409) { super(message); this.code = code; this.status = status; }
}
export const fail = (code, message, status) => { throw new PlayError(code, message, status); };
export function identifier(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,120}$/.test(value)) fail('INVALID_INPUT', 'Choose a valid character or goal.', 400);
  return value;
}
