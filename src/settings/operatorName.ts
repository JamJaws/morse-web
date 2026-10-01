export const MAX_NAME_LENGTH = 32;

export function normalizeName(value: string): string {
  return value.normalize('NFC').trim();
}

export function isValidName(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_NAME_LENGTH &&
    value === normalizeName(value) &&
    !/[\p{Cc}\p{Cf}]/u.test(value)
  );
}

export function createGuestName(): string {
  return `Guest-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}
