import { useEffect, useId, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { FaEllipsisH, FaKeyboard } from 'react-icons/fa';
import { Button } from './ui/Button';

export function MoreActionsMenu({
  triggerRef,
  onTransmitText,
}: {
  triggerRef: RefObject<HTMLButtonElement | null>;
  onTransmitText: () => void;
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const action = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    action.current?.focus();
    const dismiss = () => setOpen(false);
    const onPointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !container.current?.contains(event.target)
      )
        dismiss();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('blur', dismiss);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('blur', dismiss);
    };
  }, [open]);

  return (
    <div
      ref={container}
      className="relative"
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={event => {
        if (event.key === 'Escape' && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          triggerRef.current?.focus();
        } else if (
          event.key === 'ArrowDown' ||
          event.key === 'ArrowUp' ||
          (open && (event.key === 'Home' || event.key === 'End'))
        ) {
          event.preventDefault();
          setOpen(true);
          action.current?.focus();
        }
      }}
    >
      <Button
        ref={triggerRef}
        id={`${id}-trigger`}
        variant="ghost"
        size="icon"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={`${id}-menu`}
        className="aria-expanded:bg-raised aria-expanded:text-ink"
        onClick={() => setOpen(current => !current)}
      >
        <FaEllipsisH aria-hidden="true" />
      </Button>
      {open && (
        <div
          id={`${id}-menu`}
          role="menu"
          aria-labelledby={`${id}-trigger`}
          className="absolute right-0 top-full z-20 mt-2 w-48 rounded-2xl border border-stroke bg-surface p-1.5 shadow-xl"
        >
          <Button
            ref={action}
            role="menuitem"
            tabIndex={-1}
            variant="ghost"
            className="w-full justify-start text-ink focus-visible:outline-offset-0"
            onClick={() => {
              setOpen(false);
              onTransmitText();
            }}
          >
            <FaKeyboard aria-hidden="true" className="text-muted" />
            Transmit text
          </Button>
        </div>
      )}
    </div>
  );
}
