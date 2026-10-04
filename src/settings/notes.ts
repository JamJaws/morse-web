export const NOTES_KEY = 'morse.notes.v1';

export interface Notes {
  text: string;
  expanded: boolean;
}

export function readNotes(): Notes {
  try {
    const stored: unknown = JSON.parse(
      localStorage.getItem(NOTES_KEY) ?? 'null',
    );
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
      const values = stored as Record<string, unknown>;
      return {
        text: typeof values.text === 'string' ? values.text : '',
        expanded: values.expanded === true,
      };
    }
  } catch {
    // Notes remain usable if browser storage is unavailable or malformed.
  }
  return { text: '', expanded: false };
}
