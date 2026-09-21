import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);

// jsdom has no pointer capture or PointerEvent implementation. Model identity
// and primary-button fields so cancellation tests exercise real pointer logic.
class TestPointerEvent extends MouseEvent {
  readonly pointerId: number;
  readonly pointerType: string;
  readonly isPrimary: boolean;
  constructor(type: string, options: PointerEventInit = {}) {
    super(type, options);
    this.pointerId = options.pointerId ?? 1;
    this.pointerType = options.pointerType ?? 'mouse';
    this.isPrimary = options.isPrimary ?? true;
  }
}
Object.defineProperty(window, 'PointerEvent', { value: TestPointerEvent });
HTMLElement.prototype.setPointerCapture = () => {};
