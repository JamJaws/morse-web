import { isValidNamePreference } from './operatorName';

export const PREFERENCES_KEY = 'morse.preferences.v2';
const LEGACY_PREFERENCES_KEY = 'morse.preferences.v1';
export const preferenceRanges = {
  volume: { min: 0, max: 100 },
  frequency: { min: 400, max: 1_000 },
  wpm: { min: 4, max: 40 },
};
export interface Preferences {
  name: string;
  volume: number;
  frequency: number | null;
  wpm: number;
}
export const defaultPreferences: Preferences = {
  name: '',
  volume: 80,
  frequency: null,
  wpm: 20,
};

export function validPreference(
  key: keyof typeof preferenceRanges,
  value: unknown,
): value is number {
  const { min, max } = preferenceRanges[key];
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
  );
}

export function readPreferences(): Preferences {
  try {
    const current = localStorage.getItem(PREFERENCES_KEY);
    const stored: unknown = JSON.parse(
      current ?? localStorage.getItem(LEGACY_PREFERENCES_KEY) ?? 'null',
    );
    if (!stored || typeof stored !== 'object') return { ...defaultPreferences };
    const values = stored as Record<string, unknown>;
    const name = isValidNamePreference(values.name) ? values.name : '';
    return {
      // v1 saved generated guests as names. Only clear that format during migration.
      name: current === null && /^Guest-[0-9A-F]{6}$/.test(name) ? '' : name,
      volume: validPreference('volume', values.volume)
        ? values.volume
        : defaultPreferences.volume,
      frequency: validPreference('frequency', values.frequency)
        ? values.frequency
        : null,
      wpm: validPreference('wpm', values.wpm)
        ? values.wpm
        : defaultPreferences.wpm,
    };
  } catch {
    return { ...defaultPreferences };
  }
}
