import { useCallback, useEffect, useState } from 'react';
import {
  PREFERENCES_KEY,
  readPreferences,
  validPreference,
} from '../settings/preferences';
import type { Preferences } from '../settings/preferences';

export function usePreferences() {
  const [preferences, setPreferences] = useState(readPreferences);
  useEffect(() => {
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
    } catch {
      // Storage can be blocked or full. Controls still work for this session.
    }
  }, [preferences]);
  const update = useCallback((key: keyof Preferences, value: number) => {
    if (validPreference(key, value))
      setPreferences(current => ({ ...current, [key]: value }));
  }, []);
  return { preferences, update };
}
