import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { usePreferences } from '../src/hooks/usePreferences';
import {
  PREFERENCES_KEY,
  defaultPreferences,
} from '../src/settings/preferences';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

it('restores chosen settings across mounts, including zero volume', () => {
  const first = renderHook(usePreferences);
  act(() => {
    first.result.current.update('volume', 0);
    first.result.current.update('frequency', 950);
    first.result.current.update('wpm', 30);
  });
  first.unmount();
  const second = renderHook(usePreferences);
  expect(second.result.current.preferences).toEqual({
    volume: 0,
    frequency: 950,
    wpm: 30,
  });
});

it.each([
  'broken json',
  'null',
  '[]',
  '"text"',
  '{"volume":-1,"frequency":5000,"wpm":2}',
])('falls back safely for invalid stored data: %s', stored => {
  localStorage.setItem(PREFERENCES_KEY, stored);
  expect(renderHook(usePreferences).result.current.preferences).toEqual(
    defaultPreferences,
  );
});

it('keeps valid fields while rejecting non-numeric, fractional and out-of-range fields', () => {
  localStorage.setItem(
    PREFERENCES_KEY,
    JSON.stringify({ volume: 25, frequency: '600', wpm: 20.5 }),
  );
  const { result } = renderHook(usePreferences);
  expect(result.current.preferences).toEqual({
    volume: 25,
    frequency: null,
    wpm: 20,
  });
  act(() => {
    result.current.update('volume', NaN);
    result.current.update('frequency', 399);
    result.current.update('wpm', 41);
  });
  expect(result.current.preferences).toEqual({
    volume: 25,
    frequency: null,
    wpm: 20,
  });
});

it('keeps controls usable when storage is unavailable', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new DOMException('Blocked', 'SecurityError');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('Full', 'QuotaExceededError');
  });
  const { result } = renderHook(usePreferences);
  act(() => result.current.update('volume', 15));
  expect(result.current.preferences.volume).toBe(15);
});
