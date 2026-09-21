import { describe, it, expect } from 'vitest';
import { thresholdToBlackWhite } from '../receiptLogo';

describe('thresholdToBlackWhite', () => {
  it('turns dark pixels black and light pixels white, fully opaque', () => {
    const px = new Uint8ClampedArray([10, 10, 10, 255, 240, 240, 240, 255]);
    thresholdToBlackWhite(px);
    expect(Array.from(px)).toEqual([0, 0, 0, 255, 255, 255, 255, 255]);
  });

  it('treats transparent pixels as white, so a transparent logo background does not print as a black block', () => {
    const px = new Uint8ClampedArray([0, 0, 0, 0]);
    thresholdToBlackWhite(px);
    expect(Array.from(px)).toEqual([255, 255, 255, 255]);
  });

  it('turns a saturated mid-dark colour (e.g. brand blue) black so it stays visible on thermal paper', () => {
    const px = new Uint8ClampedArray([37, 99, 235, 255]);
    thresholdToBlackWhite(px);
    expect(px[0]).toBe(0);
  });
});
