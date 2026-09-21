export interface Operator {
  id: string;
  frequency: number;
}
export type Timed = { operatorId: string; timestamp: number; sequence: number };
export type ServerMessage =
  | ({ type: 'KEY'; down: boolean } & Timed)
  | ({ type: 'CODE'; code: string; wpm: number } & Timed)
  | { type: 'HELLO'; operatorId: string; frequency: number }
  | { type: 'OPERATORS'; operators: Operator[] }
  | { type: 'PONG'; id: number };
const finite = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);
const id = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= 128;
const frequency = (v: unknown): v is number =>
  finite(v) && v >= 400 && v <= 1_000;

export function parseMessage(data: unknown): ServerMessage | undefined {
  if (typeof data !== 'string' || data.length > 65_536) return;
  try {
    const m = JSON.parse(data);
    if (!m || typeof m !== 'object') return;
    if (m.type === 'HELLO' && id(m.operatorId) && frequency(m.frequency))
      return m;
    if (
      m.type === 'OPERATORS' &&
      Array.isArray(m.operators) &&
      m.operators.length <= 512 &&
      m.operators.every(
        (o: Operator) => o && id(o.id) && frequency(o.frequency),
      )
    )
      return m;
    if (m.type === 'PONG' && Number.isSafeInteger(m.id)) return m;
    if (
      !id(m.operatorId) ||
      !Number.isSafeInteger(m.timestamp) ||
      m.timestamp < 0 ||
      !Number.isSafeInteger(m.sequence) ||
      m.sequence <= 0
    )
      return;
    if (m.type === 'KEY' && typeof m.down === 'boolean') return m;
    if (
      m.type === 'CODE' &&
      typeof m.code === 'string' &&
      /^[.\- /]{1,2048}$/.test(m.code) &&
      Number.isInteger(m.wpm) &&
      m.wpm >= 4 &&
      m.wpm <= 40
    )
      return m;
  } catch {
    /* Ignore malformed frames without interrupting playback cleanup. */
  }
}
