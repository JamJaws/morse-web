import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { OperatorList } from '../src/components/OperatorList';

const operators = [
  { id: 'self', name: 'SA0ABC', frequency: 600 },
  { id: 'peer', name: 'Ada Lovelace', frequency: 650 },
];

it('identifies simultaneous transmitters without moving operators around', () => {
  const { rerender } = render(
    <OperatorList
      operators={operators}
      myOperatorId="self"
      activeOperatorIds={new Set()}
      connected
    />,
  );
  const originalRows = screen.getAllByRole('listitem');
  expect(within(originalRows[0]).getByText('ABC')).toBeDefined();
  expect(within(originalRows[0]).getByText('SA0ABC')).toBeDefined();
  expect(within(originalRows[1]).getByText('AL')).toBeDefined();
  expect(within(originalRows[0]).getByText('You')).toBeDefined();
  expect(within(originalRows[1]).queryByText('You')).toBeNull();

  rerender(
    <OperatorList
      operators={operators}
      myOperatorId="self"
      activeOperatorIds={new Set(['peer', 'self'])}
      connected
    />,
  );

  const rows = screen.getAllByRole('listitem');
  expect(rows[0]).toBe(originalRows[0]);
  expect(rows[1]).toBe(originalRows[1]);
  for (const row of rows) {
    expect(within(row).getByText('Transmitting')).toBeDefined();
  }
  expect(screen.getByText('2 transmitting')).toBeDefined();
});

it('keeps duplicate names distinct and renders markup as plain text', () => {
  const name = '<b>CQ</b>';
  render(
    <OperatorList
      operators={operators.map(operator => ({
        ...operator,
        name,
      }))}
      myOperatorId="peer"
      activeOperatorIds={new Set(['peer'])}
      connected
    />,
  );

  const rows = screen.getAllByRole('listitem');
  expect(within(rows[0]).getByText(name).tagName).toBe('SPAN');
  expect(within(rows[0]).queryByText('You')).toBeNull();
  expect(within(rows[1]).getByText('You')).toBeDefined();
  expect(within(rows[0]).queryByText('Transmitting')).toBeNull();
  expect(within(rows[1]).getByText('Transmitting')).toBeDefined();
});

it('offers an expandable mobile panel and distinguishes connecting from an empty roster', () => {
  const { rerender } = render(
    <OperatorList
      operators={[]}
      myOperatorId={undefined}
      activeOperatorIds={new Set()}
      connected={false}
    />,
  );
  const toggle = screen.getByRole('button', { name: 'Operators, 0 connected' });
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(toggle);
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  const scrollRegion = screen.getByRole('region', { name: 'Operator list' });
  expect(toggle.getAttribute('aria-controls')).toBe(scrollRegion.id);
  expect(scrollRegion.tabIndex).toBe(0);
  scrollRegion.focus();
  expect(document.activeElement).toBe(scrollRegion);
  expect(screen.getByText('Connecting…')).toBeDefined();

  rerender(
    <OperatorList
      operators={[]}
      myOperatorId={undefined}
      activeOperatorIds={new Set()}
      connected
    />,
  );
  expect(screen.getByText('No operators connected.')).toBeDefined();
  expect(screen.queryByText('Connecting…')).toBeNull();
});
