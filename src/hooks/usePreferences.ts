import { useCallback, useEffect, useState } from 'react';
import {
  PREFERENCES_KEY,
  readPreferences,
  validPreference,
  preferenceRanges,
} from '../settings/preferences';
import { isValidName } from '../settings/operatorName';

export function usePreferences() {
  const [preferences, setPreferences] = useState(() => {
    const stored = readPreferences();
    return {
      ...stored,
      frequency: stored.frequency ?? 600 + Math.floor(Math.random() * 401),
    };
  });
  useEffect(() => {
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
    } catch {
      // Storage can be blocked or full. Controls still work for this session.
    }
  }, [preferences]);
  const update = useCallback(
    (key: keyof typeof preferenceRanges, value: number) => {
      if (validPreference(key, value))
        setPreferences(current => ({ ...current, [key]: value }));
    },
    [],
  );
  const updateName = useCallback((name: string) => {
    if (isValidName(name)) setPreferences(current => ({ ...current, name }));
  }, []);
  return { preferences, update, updateName };
}
