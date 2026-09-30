import { useCallback, useEffect, useRef } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';

type HeldInput = { key: string } | { pointerId: number };

/** Only the input that started a mark can release it; blur always cancels. */
export function useMorseKey(
  enabled: boolean,
  start: () => boolean,
  stop: () => void,
) {
  const keyRef = useRef<HTMLButtonElement>(null);
  const held = useRef<HeldInput | undefined>(undefined);
  const cancel = useCallback(() => {
    held.current = undefined;
    stop();
  }, [stop]);

  const focusKey = useCallback(() => {
    if (!enabled) return;
    cancel();
    keyRef.current?.focus();
  }, [enabled, cancel]);

  useEffect(() => {
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (
        !enabled ||
        event.key !== 'Escape' ||
        event.defaultPrevented ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.isComposing
      )
        return;
      event.preventDefault();
      focusKey();
    };
    // Menus and popovers can consume Escape before it reaches the window.
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [enabled, focusKey]);

  useEffect(() => {
    if (!enabled) cancel();
  }, [enabled, cancel]);

  useEffect(() => {
    const releaseKey = (event: globalThis.KeyboardEvent) => {
      if (
        held.current &&
        'key' in held.current &&
        held.current.key === event.key
      )
        cancel();
    };
    const releasePointer = (event: globalThis.PointerEvent) => {
      if (
        held.current &&
        'pointerId' in held.current &&
        held.current.pointerId === event.pointerId
      )
        cancel();
    };
    const hide = () => {
      if (document.visibilityState === 'hidden') cancel();
    };
    window.addEventListener('keyup', releaseKey, true);
    window.addEventListener('pointerup', releasePointer, true);
    window.addEventListener('pointercancel', releasePointer, true);
    window.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.removeEventListener('keyup', releaseKey, true);
      window.removeEventListener('pointerup', releasePointer, true);
      window.removeEventListener('pointercancel', releasePointer, true);
      window.removeEventListener('blur', cancel);
      document.removeEventListener('visibilitychange', hide);
      cancel();
    };
  }, [cancel]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (
      !enabled ||
      event.currentTarget !== document.activeElement ||
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.nativeEvent.isComposing
    )
      return;
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    if (!event.repeat && !held.current && start())
      held.current = { key: event.key };
  };

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (!enabled || !event.isPrimary || event.button !== 0 || held.current)
      return;
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    if (start()) held.current = { pointerId: event.pointerId };
  };

  const onLostPointerCapture = (event: PointerEvent<HTMLButtonElement>) => {
    if (
      held.current &&
      'pointerId' in held.current &&
      held.current.pointerId === event.pointerId
    )
      cancel();
  };

  return {
    keyRef,
    focusKey,
    onKeyDown,
    onPointerDown,
    onLostPointerCapture,
    cancel,
  };
}
