// Barcode helpers: validation, UPC-E expansion and extraction from QR payloads.

/** Standard GS1 mod-10 check for EAN-13, UPC-A (12), EAN-8 and GTIN-14. */
export function hasValidChecksum(code: string): boolean {
  if (!/^\d+$/.test(code)) return false;
  if (![8, 12, 13, 14].includes(code.length)) return false;
  const digits = code.split('').map(Number);
  const check = digits.pop() as number;
  let sum = 0;
  // weights alternate 3,1 starting from the digit next to the check digit
  for (let i = digits.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += digits[i] * w;
  return (10 - (sum % 10)) % 10 === check;
}

/** Expand an 8-digit UPC-E (number system 0/1) to its 12-digit UPC-A. */
export function upcEToUpcA(upcE: string): string | null {
  if (!/^[01]\d{7}$/.test(upcE)) return null;
  const ns = upcE[0];
  const d = upcE.slice(1, 7).split('');
  const check = upcE[7];
  const last = d[5];
  let body: string;
  if (last === '0' || last === '1' || last === '2') body = `${d[0]}${d[1]}${last}0000${d[2]}${d[3]}${d[4]}`;
  else if (last === '3') body = `${d[0]}${d[1]}${d[2]}00000${d[3]}${d[4]}`;
  else if (last === '4') body = `${d[0]}${d[1]}${d[2]}${d[3]}00000${d[4]}`;
  else body = `${d[0]}${d[1]}${d[2]}${d[3]}${d[4]}0000${last}`;
  return `${ns}${body}${check}`;
}

export type NormalisedBarcode = { ok: true; code: string; lookupCodes: string[] } | { ok: false; reason: string };

/**
 * Turn whatever the camera read into candidate product codes.
 * Accepts bare EAN/UPC digits, or a QR payload containing a code / Open Food Facts product link.
 */
export function normaliseScan(raw: string): NormalisedBarcode {
  const text = (raw ?? '').trim();
  if (!text) return { ok: false, reason: 'Empty barcode' };

  let code = text;
  if (!/^\d+$/.test(text)) {
    // QR with a product link or embedded digits, e.g. https://world.openfoodfacts.org/product/3017620422003/nutella
    const m = text.match(/(?:product\/|code=|gtin=|barcode=|\/)(\d{8,14})(?:\D|$)/i) ?? text.match(/\b(\d{8,14})\b/);
    if (!m) return { ok: false, reason: 'This QR code does not contain a product barcode' };
    code = m[1];
  }

  if (!hasValidChecksum(code)) {
    // 8-digit UPC-E uses a different layout; validate via expansion.
    const expanded = code.length === 8 ? upcEToUpcA(code) : null;
    if (expanded && hasValidChecksum(expanded)) return { ok: true, code, lookupCodes: [expanded, `0${expanded}`] };
    return { ok: false, reason: 'Invalid barcode (checksum failed). Try scanning again.' };
  }

  // OFF stores UPC-A as 13-digit with a leading 0; try both forms.
  const lookupCodes = code.length === 12 ? [`0${code}`, code] : [code];
  return { ok: true, code, lookupCodes };
}
