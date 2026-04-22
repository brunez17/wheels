export function normalizeHex(input: string): string {
  let s = input.trim();
  if (!s.startsWith('#')) s = `#${s}`;
  if (/^#[0-9A-Fa-f]{3}$/.test(s)) {
    const r = s[1];
    const g = s[2];
    const b = s[3];
    s = `#${r}${r}${g}${g}${b}${b}`;
  }
  return s.toUpperCase();
}

export function isValidHex(input: string): boolean {
  const s = normalizeHex(input);
  return /^#[0-9A-F]{6}$/.test(s);
}
