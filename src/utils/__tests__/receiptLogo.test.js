import { describe, it, expect } from 'vitest';
import { thresholdToBlackWhite, otsuThreshold } from '../receiptLogo';

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

describe('otsuThreshold', () => {
  it('picks a cut between a dark logo and a light-grey background, so a soft logo keeps its shape', () => {
    // 3 dark-grey logo pixels (70) over 5 light-grey background pixels (200)
    const px = new Uint8ClampedArray([70,70,70,255, 70,70,70,255, 70,70,70,255, 200,200,200,255, 200,200,200,255, 200,200,200,255, 200,200,200,255, 200,200,200,255]);
    const t = otsuThreshold(px);
    expect(t).toBeGreaterThanOrEqual(70);
    expect(t).toBeLessThan(200);
    thresholdToBlackWhite(px);
    expect(px[0]).toBe(0);
    expect(px[12]).toBe(255);
  });

  it('falls back to a fixed threshold when every pixel is the same', () => {
    expect(otsuThreshold(new Uint8ClampedArray([128,128,128,255, 128,128,128,255]))).toBe(140);
  });
});
