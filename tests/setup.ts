import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);

// jsdom implements PointerEvent but does not implement pointer capture.
HTMLElement.prototype.setPointerCapture = () => {};
