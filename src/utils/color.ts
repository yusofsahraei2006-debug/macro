/** Mix two #RRGGBB colours (t = 0 -> a, 1 -> b). */
export function mix(a: string, b: string, t: number): string {
  const k = Math.min(1, Math.max(0, t));
  const pa = parseInt(a.slice(1, 7), 16), pb = parseInt(b.slice(1, 7), 16);
  const ch = (p: number, s: number) => (p >> s) & 255;
  const c = (s: number) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * k).toString(16).padStart(2, '0');
  return `#${c(16)}${c(8)}${c(0)}`;
}

/** Rich gold used as progress approaches a goal. */
export const GOLD = '#FFB703';
export const GOLD_LIGHT = '#FFE58A';

/** 0 until halfway to the goal, then ramps to 1 at the goal. */
export const goldAmount = (progress: number) => Math.min(1, Math.max(0, (progress - 0.5) / 0.5));
