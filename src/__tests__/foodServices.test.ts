import { hasValidChecksum, normaliseScan, upcEToUpcA } from '@/services/barcode';
import { energyKcalPer100, parseOffProduct } from '@/services/openFoodFacts';
import { parseUsdaFood } from '@/services/usda';

// Fixtures below are hand-written in the documented API shapes; they are NOT live API responses.

describe('barcode validation', () => {
  it('accepts valid EAN-13, EAN-8 and UPC-A', () => {
    expect(hasValidChecksum('3017620422003')).toBe(true); // EAN-13
    expect(hasValidChecksum('96385074')).toBe(true); // EAN-8
    expect(hasValidChecksum('036000291452')).toBe(true); // UPC-A
  });
  it('rejects bad checksums, wrong lengths and non-digits', () => {
    expect(hasValidChecksum('3017620422004')).toBe(false);
    expect(hasValidChecksum('12345')).toBe(false);
    expect(hasValidChecksum('30176204220ab')).toBe(false);
  });
  it('expands UPC-E to a valid UPC-A', () => {
    const a = upcEToUpcA('04252614');
    expect(a).toBe('042100005264');
    expect(hasValidChecksum(a as string)).toBe(true);
  });
  it('normalises scans and tries both UPC-A forms', () => {
    const r = normaliseScan('036000291452');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.lookupCodes).toEqual(['0036000291452', '036000291452']);
  });
  it('extracts a barcode from an Open Food Facts QR link', () => {
    const r = normaliseScan('https://world.openfoodfacts.org/product/3017620422003/nutella');
    expect(r.ok && r.code).toBe('3017620422003');
  });
  it('flags invalid and non-product QR content', () => {
    expect(normaliseScan('3017620422004').ok).toBe(false);
    expect(normaliseScan('hello world').ok).toBe(false);
    expect(normaliseScan('').ok).toBe(false);
  });
});

describe('Open Food Facts parsing', () => {
  it('uses kcal when present', () => {
    expect(energyKcalPer100({ 'energy-kcal_100g': 539 })).toBe(539);
  });
  it('converts kilojoules to kcal and never treats kJ as kcal', () => {
    const kcal = energyKcalPer100({ energy_100g: 2255 }) as number;
    expect(kcal).toBeCloseTo(538.98, 1);
    expect(energyKcalPer100({ 'energy-kj_100g': 418.4 })).toBeCloseTo(100, 5);
  });
  it('parses a product into per-unit values', () => {
    const f = parseOffProduct({
      code: '3017620422003',
      product_name: 'Hazelnut spread',
      brands: 'Brand A, Brand B',
      serving_quantity: '15',
      nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9, sugars_100g: 56.3 },
    });
    expect(f).not.toBeNull();
    expect(f?.brand).toBe('Brand A');
    expect(f?.unit).toBe('g');
    expect(f?.kcalPerUnit).toBeCloseTo(5.39);
    expect(f?.proteinPerUnit).toBeCloseTo(0.063);
    expect(f?.servingQty).toBe(15);
    expect(f?.fibrePerUnit).toBeNull();
  });
  it('detects liquids as ml', () => {
    const f = parseOffProduct({ product_name: 'Cola', serving_size: '330 ml', nutriments: { 'energy-kcal_100g': 42 } });
    expect(f?.unit).toBe('ml');
  });
  it('returns null when energy is missing (no invented values)', () => {
    expect(parseOffProduct({ product_name: 'Mystery', nutriments: { proteins_100g: 5 } })).toBeNull();
    expect(parseOffProduct({ nutriments: { 'energy-kcal_100g': 100 } })).toBeNull();
  });
});

describe('USDA parsing', () => {
  it('maps nutrients to per-gram values', () => {
    const f = parseUsdaFood({
      fdcId: 1105073,
      description: 'BANANAS, RAW',
      foodNutrients: [
        { nutrientNumber: '208', unitName: 'KCAL', value: 89 },
        { nutrientNumber: '203', unitName: 'G', value: 1.09 },
        { nutrientNumber: '205', unitName: 'G', value: 22.8 },
        { nutrientNumber: '204', unitName: 'G', value: 0.33 },
        { nutrientNumber: '291', unitName: 'G', value: 2.6 },
      ],
    });
    expect(f?.name).toBe('Bananas, raw');
    expect(f?.kcalPerUnit).toBeCloseTo(0.89);
    expect(f?.carbsPerUnit).toBeCloseTo(0.228);
    expect(f?.fibrePerUnit).toBeCloseTo(0.026);
    expect(f?.sugarPerUnit).toBeNull();
  });
  it('ignores a kJ energy row and returns null without kcal', () => {
    expect(parseUsdaFood({ fdcId: 2, description: 'x', foodNutrients: [{ nutrientNumber: '268', unitName: 'KJ', value: 372 }] })).toBeNull();
  });
});
