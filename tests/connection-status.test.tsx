import { fireEvent, render, screen } from '@testing-library/react';
import { ReadyState } from 'react-use-websocket';
import { expect, it } from 'vitest';
import { ConnectionStatus } from '../src/components/ConnectionStatus';

function openStatus() {
  const view = render(
    <ConnectionStatus
      readyState={ReadyState.OPEN}
      operators={3}
      latency={42}
    />,
  );
  const trigger = screen.getByRole('button', {
    name: 'Connection details: Connected',
  });
  return { ...view, trigger };
}

function details() {
  return screen.queryByRole('group', { name: 'Connection details' });
}

it('previews on mouse hover and stays open while moving into the panel', () => {
  const { trigger } = openStatus();
  expect(details()).toBeNull();
  fireEvent.pointerOver(trigger, { pointerType: 'mouse' });
  const panel = details()!;
  expect(panel).not.toBeNull();

  fireEvent.pointerOut(trigger, {
    pointerType: 'mouse',
    relatedTarget: panel,
  });
  fireEvent.pointerOver(panel, {
    pointerType: 'mouse',
    relatedTarget: trigger,
  });
  expect(details()).not.toBeNull();
  fireEvent.pointerOut(panel, {
    pointerType: 'mouse',
    relatedTarget: document.body,
  });
  expect(details()).toBeNull();
});

it('previews on keyboard focus and closes when focus leaves', () => {
  const { trigger } = openStatus();
  fireEvent.focus(trigger);
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  expect(trigger.getAttribute('aria-controls')).toBe(details()!.id);
  fireEvent.blur(trigger, { relatedTarget: document.body });
  expect(details()).toBeNull();
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
});

it('pins on click and closes on a second click even while focused and hovered', () => {
  const { trigger } = openStatus();
  fireEvent.pointerOver(trigger, { pointerType: 'mouse' });
  fireEvent.click(trigger);
  fireEvent.pointerOut(trigger, {
    pointerType: 'mouse',
    relatedTarget: document.body,
  });
  expect(details()).not.toBeNull();

  fireEvent.pointerOver(trigger, { pointerType: 'mouse' });
  fireEvent.focus(trigger);
  fireEvent.click(trigger);
  expect(details()).toBeNull();
});

it('keeps Escape dismissal until a new interaction instead of reopening on updates', () => {
  const { trigger, rerender } = openStatus();
  fireEvent.pointerOver(trigger, { pointerType: 'mouse' });
  fireEvent.focus(trigger);
  fireEvent.click(trigger);
  fireEvent.keyDown(trigger, { key: 'Escape' });
  expect(details()).toBeNull();
  rerender(
    <ConnectionStatus
      readyState={ReadyState.OPEN}
      operators={4}
      latency={51}
    />,
  );
  expect(details()).toBeNull();

  fireEvent.click(trigger);
  expect(details()).not.toBeNull();
  fireEvent.keyDown(trigger, { key: 'Escape' });
  fireEvent.blur(trigger, { relatedTarget: document.body });
  fireEvent.focus(trigger);
  expect(details()).not.toBeNull();
});

it('uses taps rather than synthetic touch hover and supports repeated taps', () => {
  const { trigger } = openStatus();
  fireEvent.pointerOver(trigger, { pointerType: 'touch' });
  expect(details()).toBeNull();
  fireEvent.pointerDown(trigger, { pointerType: 'touch' });
  fireEvent.focus(trigger);
  fireEvent.pointerUp(trigger, { pointerType: 'touch' });
  fireEvent.click(trigger);
  fireEvent.pointerOut(trigger, {
    pointerType: 'touch',
    relatedTarget: document.body,
  });
  expect(details()).not.toBeNull();

  fireEvent.pointerDown(trigger, { pointerType: 'touch' });
  fireEvent.pointerUp(trigger, { pointerType: 'touch' });
  fireEvent.click(trigger);
  expect(details()).toBeNull();
});

it('dismisses on outside presses and window blur without closing on panel presses', () => {
  const { trigger } = openStatus();
  fireEvent.focus(trigger);
  fireEvent.click(trigger);
  fireEvent.pointerDown(details()!, { pointerType: 'touch' });
  expect(details()).not.toBeNull();
  fireEvent.pointerDown(document.body, { pointerType: 'touch' });
  expect(details()).toBeNull();

  fireEvent.click(trigger);
  expect(details()).not.toBeNull();
  fireEvent.blur(window);
  expect(details()).toBeNull();
});
