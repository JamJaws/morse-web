export const PREFERENCES_KEY = 'morse.preferences.v1';
export const preferenceRanges = {
  volume: { min: 0, max: 100 },
  frequency: { min: 400, max: 1_000 },
  wpm: { min: 4, max: 40 },
};
export interface Preferences {
  volume: number;
  frequency: number | null;
  wpm: number;
}
export const defaultPreferences: Preferences = {
  volume: 80,
  frequency: null,
  wpm: 20,
};

export function validPreference(
  key: keyof Preferences,
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
    const stored: unknown = JSON.parse(
      localStorage.getItem(PREFERENCES_KEY) ?? 'null',
    );
    if (!stored || typeof stored !== 'object') return { ...defaultPreferences };
    const values = stored as Record<string, unknown>;
    return {
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
