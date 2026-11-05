import { Food } from '@/types/food';

// Lets the search screen hand a chosen food back to the screen that opened it in "pick" mode
// (used when building saved meals). Cleared after use.
let handler: ((f: Food) => void) | null = null;

export const setPickHandler = (fn: ((f: Food) => void) | null) => { handler = fn; };
export const takePickHandler = () => handler;
