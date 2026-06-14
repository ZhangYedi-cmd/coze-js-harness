/// <reference types="vitest" />
/* eslint-disable */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  isReady: true as boolean,
  capturedOnready: null as ((() => void) | null),
  decodeRaw: vi.fn(),
  destroy: vi.fn(),
}));

vi.mock('opus-encdec/src/oggOpusDecoder.js', () => ({
  OggOpusDecoder: vi.fn().mockImplementation(() => {
    const obj: Record<string, unknown> = {
      decodeRaw: mockState.decodeRaw,
      destroy: mockState.destroy,
    };
    Object.defineProperty(obj, 'isReady', {
      get: () => mockState.isReady,
      enumerable: true,
      configurable: true,
    });
    // onready getter returns a no-op when decoder is not ready (truthy sentinel)
    Object.defineProperty(obj, 'onready', {
      get: () => (mockState.isReady ? undefined : function noop() {}),
      set: (fn: () => void) => {
        mockState.capturedOnready = fn;
      },
      enumerable: true,
      configurable: true,
    });
    return obj;
  }),
}));

vi.mock('opus-encdec/dist/libopus-decoder.js', () => ({
  default: {},
}));

import OpusDecoder from '@ws-tools/chat/opus-decoder';

describe('OpusDecoder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.isReady = true;
    mockState.capturedOnready = null;
  });

  describe('constructor', () => {
    it('marks decoder ready immediately when isReady is true', () => {
      mockState.isReady = true;
      const decoder = new OpusDecoder({});
      expect(decoder.isReady()).toBe(true);
    });

    it('marks decoder ready when onready fires and isReady starts false', () => {
      mockState.isReady = false;
      const decoder = new OpusDecoder({});
      expect(decoder.isReady()).toBe(false);

      // the constructor assigned onready; call it to simulate decoder becoming ready
      expect(mockState.capturedOnready).toBeTypeOf('function');
      mockState.capturedOnready!();
      expect(decoder.isReady()).toBe(true);
    });
  });

  describe('decode', () => {
    it('returns Int16Array converted from Float32Array callback', () => {
      const float32Data = new Float32Array([0.5, -0.5, 1.0, -1.0]);
      mockState.decodeRaw.mockImplementation(
        (_input: Uint8Array, cb: (buf: Float32Array) => void) => {
          cb(float32Data);
        },
      );

      const decoder = new OpusDecoder({});
      const result = decoder.decode(new Uint8Array([1, 2, 3]));

      expect(result).toBeInstanceOf(Int16Array);
      expect(result).toHaveLength(4);
      expect(result![0]).toBe(Math.floor(0.5 * 0x8000));
      expect(result![1]).toBe(Math.floor(-0.5 * 0x8000));
    });

    it('returns null when decodeRaw never calls the callback', () => {
      mockState.decodeRaw.mockImplementation(() => {
        // no callback call
      });

      const decoder = new OpusDecoder({});
      const result = decoder.decode(new Uint8Array([1, 2]));
      expect(result).toBeNull();
    });

    it('returns null and logs error when decodeRaw throws', () => {
      mockState.decodeRaw.mockImplementation(() => {
        throw new Error('decode error');
      });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const decoder = new OpusDecoder({});
      const result = decoder.decode(new Uint8Array([1, 2]));

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error decoding Opus data:',
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });
  });

  describe('isReady', () => {
    it('returns true when decoder was ready at construction', () => {
      mockState.isReady = true;
      const decoder = new OpusDecoder({});
      expect(decoder.isReady()).toBe(true);
    });

    it('returns false when decoder was not ready and onready has not fired', () => {
      mockState.isReady = false;
      const decoder = new OpusDecoder({});
      expect(decoder.isReady()).toBe(false);
    });
  });

  describe('waitForReady', () => {
    it('resolves immediately when already ready', async () => {
      mockState.isReady = true;
      const decoder = new OpusDecoder({});
      await expect(decoder.waitForReady()).resolves.toBeUndefined();
    });

    it('resolves after polling detects decoderReady becomes true', async () => {
      vi.useFakeTimers();
      mockState.isReady = false;
      const decoder = new OpusDecoder({});
      expect(decoder.isReady()).toBe(false);

      const waitPromise = decoder.waitForReady();

      // trigger the onready callback to flip decoderReady inside decoder
      mockState.capturedOnready?.();
      vi.advanceTimersByTime(20);

      await waitPromise;
      expect(decoder.isReady()).toBe(true);
      vi.useRealTimers();
    });
  });

  describe('destroy', () => {
    it('calls destroy on underlying OggOpusDecoder', () => {
      const decoder = new OpusDecoder({});
      decoder.destroy();
      expect(mockState.destroy).toHaveBeenCalled();
    });
  });
});
