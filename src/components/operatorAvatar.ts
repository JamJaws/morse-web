// Common ITU-style callsigns, including prefixes such as 2E, J2 and 3DA.
// This heuristic chooses avatar text; it does not validate an operator's identity.
const CALLSIGN =
  /^(?:[BFGIKMNRW]|[A-Z]{2}|[A-Z]\d|\d[A-Z]{1,2})\d([A-Z]{1,4})$/i;
const CALLSIGN_PARTS = /^[A-Z0-9]+(?:\/[A-Z0-9]+)*$/i;

export function operatorAvatarText(name: string): string {
  const trimmed = name.trim();
  if (CALLSIGN_PARTS.test(trimmed)) {
    const suffixes = trimmed.split('/').flatMap(part => {
      const match = CALLSIGN.exec(part);
      return match ? [match[1]] : [];
    });
    if (suffixes.length === 1) return suffixes[0].toUpperCase();
  }

  const words = trimmed.split(/\s+/);
  const first = Array.from(words[0] ?? '');
  return (
    words.length > 1
      ? `${first[0] ?? ''}${Array.from(words[words.length - 1])[0] ?? ''}`
      : first.slice(0, 2).join('')
  ).toUpperCase();
}
