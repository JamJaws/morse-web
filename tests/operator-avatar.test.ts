import { expect, it } from 'vitest';
import { operatorAvatarText } from '../src/components/operatorAvatar';

it.each([
  ['SA7AON', 'AON'],
  ['SA7AOI', 'AOI'],
  ['SA7AOM', 'AOM'],
  ['W1AW', 'AW'],
  ['G4ABC', 'ABC'],
  ['2E0ABC', 'ABC'],
  ['9A1XYZ', 'XYZ'],
  ['J29DBA', 'DBA'],
  ['3DA0XYZ', 'XYZ'],
  ['W1A', 'A'],
  ['N0CALL', 'CALL'],
  ['  sa7aon  ', 'AON'],
  ['SA7AON/P', 'AON'],
  ['F/SA7AON', 'AON'],
  ['f/sa7aon/p', 'AON'],
  ['EA8/W1AW/MM', 'AW'],
  ['SA7AON/7', 'AON'],
])('uses the callsign suffix for %s', (name, expected) => {
  expect(operatorAvatarText(name)).toBe(expected);
});

it.each([
  ['John Mogensen', 'JM'],
  ['Spock', 'SP'],
  ['Jean-Luc Picard', 'JP'],
  ['  Åsa   Öberg  ', 'ÅÖ'],
  ['😀 Alice', '😀A'],
  ['Guest-A', 'GU'],
  ['123ABC', '12'],
  ['John7', 'JO'],
  ['C3PO', 'C3'],
  ['R2D2', 'R2'],
  ['John SA7AON', 'JS'],
  ['SA7AON//P', 'SA'],
  ['SA7AON/P!', 'SA'],
  ['W1AW/K1ABC', 'W1'],
])(
  'keeps ordinary initials when %s is not a clear callsign',
  (name, expected) => {
    expect(operatorAvatarText(name)).toBe(expected);
  },
);
