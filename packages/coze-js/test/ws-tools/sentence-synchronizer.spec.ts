/// <reference types="vitest" />
/* eslint-disable */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { SentenceSynchronizer } from '@ws-tools/chat/sentence-synchronizer';
import {
  WsChatEventNames,
  ClientEventType,
} from '@ws-tools/chat/../types';
import { WebsocketsEventType } from '@/index';

function makeSentenceStartEvent(id: string, text: string) {
  return {
    id,
    event_type: WebsocketsEventType.CONVERSATION_AUDIO_SENTENCE_START,
    data: { text },
    detail: { logid: 'test' },
  } as any;
}

describe('SentenceSynchronizer', () => {
  let eventEmitter: ReturnType<typeof vi.fn>;
  let synchronizer: SentenceSynchronizer;

  beforeEach(() => {
    vi.useFakeTimers();
    eventEmitter = vi.fn();
    synchronizer = new SentenceSynchronizer({ eventEmitter });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('initializes with default values', () => {
      expect(synchronizer['sentenceList']).toHaveLength(0);
      expect(synchronizer['currentSentenceIndex']).toBe(-1);
      expect(synchronizer['firstAudioDeltaTime']).toBeNull();
      expect(synchronizer['sentenceSwitchTimer']).toBeNull();
      expect(synchronizer['outputAudioSampleRate']).toBe(24000);
      expect(synchronizer['outputAudioCodec']).toBe('pcm');
    });
  });

  describe('setOutputAudioConfig', () => {
    it('updates sample rate and codec', () => {
      synchronizer.setOutputAudioConfig(16000, 'opus');
      expect(synchronizer['outputAudioSampleRate']).toBe(16000);
      expect(synchronizer['outputAudioCodec']).toBe('opus');
    });
  });

  describe('handleAudioCompleted', () => {
    it('does nothing when sentence list is empty', () => {
      expect(() => synchronizer.handleAudioCompleted()).not.toThrow();
    });

    it('marks last sentence as last and duration finish', () => {
      synchronizer['sentenceList'] = [
        { id: 's1', content: 'hello', audioDuration: 100, isLastSentence: false, isDurationFinish: false },
        { id: 's2', content: 'world', audioDuration: 200, isLastSentence: false, isDurationFinish: false },
      ];
      synchronizer.handleAudioCompleted();
      expect(synchronizer['sentenceList'][1].isLastSentence).toBe(true);
      expect(synchronizer['sentenceList'][1].isDurationFinish).toBe(true);
      expect(synchronizer['sentenceList'][0].isLastSentence).toBe(false);
    });
  });

  describe('handleSentenceStart', () => {
    it('adds first sentence and emits sentence start immediately', () => {
      const event = makeSentenceStartEvent('s1', 'Hello');
      synchronizer.handleSentenceStart(event);

      expect(synchronizer['sentenceList']).toHaveLength(1);
      expect(synchronizer['sentenceList'][0]).toMatchObject({
        id: 's1',
        content: 'Hello',
        audioDuration: 0,
        isLastSentence: false,
        isDurationFinish: false,
      });
      expect(synchronizer['currentSentenceIndex']).toBe(0);
      expect(eventEmitter).toHaveBeenCalledWith(
        WsChatEventNames.AUDIO_SENTENCE_PLAYBACK_START,
        expect.objectContaining({
          event_type: ClientEventType.AUDIO_SENTENCE_PLAYBACK_START,
          data: { content: 'Hello', id: 's1' },
        }),
      );
    });

    it('marks previous sentence isDurationFinish when second sentence starts', () => {
      synchronizer.handleSentenceStart(makeSentenceStartEvent('s1', 'First'));
      synchronizer.handleSentenceStart(makeSentenceStartEvent('s2', 'Second'));

      expect(synchronizer['sentenceList']).toHaveLength(2);
      expect(synchronizer['sentenceList'][0].isDurationFinish).toBe(true);
    });

    it('does not emit start for second sentence immediately', () => {
      synchronizer.handleSentenceStart(makeSentenceStartEvent('s1', 'First'));
      eventEmitter.mockClear();
      synchronizer.handleSentenceStart(makeSentenceStartEvent('s2', 'Second'));

      expect(eventEmitter).not.toHaveBeenCalledWith(
        WsChatEventNames.AUDIO_SENTENCE_PLAYBACK_START,
        expect.objectContaining({ data: expect.objectContaining({ id: 's2' }) }),
      );
    });
  });

  describe('updateAudioDuration', () => {
    it('increments audio duration for matching sentence id', () => {
      synchronizer['sentenceList'] = [
        { id: 's1', content: 'hello', audioDuration: 0, isLastSentence: false, isDurationFinish: false },
      ];
      synchronizer.updateAudioDuration('s1', 500);
      expect(synchronizer['sentenceList'][0].audioDuration).toBe(500);

      synchronizer.updateAudioDuration('s1', 300);
      expect(synchronizer['sentenceList'][0].audioDuration).toBe(800);
    });

    it('does nothing when sentence id not found', () => {
      synchronizer['sentenceList'] = [
        { id: 's1', content: 'hello', audioDuration: 100, isLastSentence: false, isDurationFinish: false },
      ];
      synchronizer.updateAudioDuration('unknown', 500);
      expect(synchronizer['sentenceList'][0].audioDuration).toBe(100);
    });
  });

  describe('updateLatestSentenceAudioDuration', () => {
    it('returns false when sentence list is empty', () => {
      expect(synchronizer.updateLatestSentenceAudioDuration(100)).toBe(false);
    });

    it('calculates PCM duration correctly and adds to last sentence', () => {
      synchronizer['sentenceList'] = [
        { id: 's1', content: 'hello', audioDuration: 0, isLastSentence: false, isDurationFinish: false },
      ];
      // PCM 16bit @ 24000: (bytes / 2) / 24000 * 1000
      // 48000 bytes → (48000/2)/24000*1000 = 1000ms
      const result = synchronizer.updateLatestSentenceAudioDuration(48000);
      expect(result).toBe(true);
      expect(synchronizer['sentenceList'][0].audioDuration).toBeCloseTo(1000);
    });

    it('calculates non-PCM (8-bit) duration correctly', () => {
      synchronizer.setOutputAudioConfig(24000, 'g711a');
      synchronizer['sentenceList'] = [
        { id: 's1', content: 'hello', audioDuration: 0, isLastSentence: false, isDurationFinish: false },
      ];
      // g711a 8bit @ 24000: (bytes / 1) / 24000 * 1000
      // 24000 bytes → 1000ms
      synchronizer.updateLatestSentenceAudioDuration(24000);
      expect(synchronizer['sentenceList'][0].audioDuration).toBeCloseTo(1000);
    });

    it('accumulates duration across calls', () => {
      synchronizer['sentenceList'] = [
        { id: 's1', content: 'hello', audioDuration: 500, isLastSentence: false, isDurationFinish: false },
      ];
      synchronizer.updateLatestSentenceAudioDuration(48000);
      expect(synchronizer['sentenceList'][0].audioDuration).toBeCloseTo(1500);
    });
  });

  describe('setFirstAudioDeltaTime', () => {
    it('sets firstAudioDeltaTime when first sentence has zero audioDuration', () => {
      synchronizer['currentSentenceIndex'] = 0;
      synchronizer['sentenceList'] = [
        { id: 's1', content: 'hello', audioDuration: 0, isLastSentence: false, isDurationFinish: false },
      ];
      synchronizer.setFirstAudioDeltaTime();
      expect(synchronizer['firstAudioDeltaTime']).not.toBeNull();
    });

    it('does not set firstAudioDeltaTime when not on first sentence', () => {
      synchronizer['currentSentenceIndex'] = 1;
      synchronizer['sentenceList'] = [
        { id: 's1', content: 'hello', audioDuration: 0, isLastSentence: false, isDurationFinish: false },
        { id: 's2', content: 'world', audioDuration: 0, isLastSentence: false, isDurationFinish: false },
      ];
      synchronizer.setFirstAudioDeltaTime();
      expect(synchronizer['firstAudioDeltaTime']).toBeNull();
    });

    it('does not set firstAudioDeltaTime when audioDuration is not zero', () => {
      synchronizer['currentSentenceIndex'] = 0;
      synchronizer['sentenceList'] = [
        { id: 's1', content: 'hello', audioDuration: 100, isLastSentence: false, isDurationFinish: false },
      ];
      synchronizer.setFirstAudioDeltaTime();
      expect(synchronizer['firstAudioDeltaTime']).toBeNull();
    });
  });

  describe('resetSentenceSyncState', () => {
    it('emits sentence end if there are sentences, then resets state', () => {
      synchronizer['sentenceList'] = [
        { id: 's1', content: 'hello', audioDuration: 100, isLastSentence: false, isDurationFinish: false },
      ];
      synchronizer['currentSentenceIndex'] = 0;
      synchronizer['firstAudioDeltaTime'] = 12345;
      const timer = setTimeout(() => {}, 9999);
      synchronizer['sentenceSwitchTimer'] = timer;

      synchronizer.resetSentenceSyncState();

      expect(eventEmitter).toHaveBeenCalledWith(
        WsChatEventNames.AUDIO_SENTENCE_PLAYBACK_ENDED,
        expect.objectContaining({ event_type: ClientEventType.AUDIO_SENTENCE_PLAYBACK_ENDED }),
      );
      expect(synchronizer['currentSentenceIndex']).toBe(-1);
      expect(synchronizer['sentenceList']).toHaveLength(0);
      expect(synchronizer['firstAudioDeltaTime']).toBeNull();
      expect(synchronizer['sentenceSwitchTimer']).toBeNull();
    });

    it('does not emit sentence end if sentence list is empty', () => {
      synchronizer.resetSentenceSyncState();
      expect(eventEmitter).not.toHaveBeenCalled();
    });
  });

  describe('scheduleSentenceSwitch (via handleSentenceStart)', () => {
    it('schedules next sentence switch when duration is set and duration is complete', () => {
      synchronizer.handleSentenceStart(makeSentenceStartEvent('s1', 'First'));
      synchronizer.handleSentenceStart(makeSentenceStartEvent('s2', 'Second'));

      // Set duration for s1 and mark it done
      synchronizer['sentenceList'][0].audioDuration = 500;

      eventEmitter.mockClear();

      // Advance timer past the re-check delay to trigger isDurationFinish path
      vi.advanceTimersByTime(200);

      // now sentenceList[0].isDurationFinish is already true (set by second handleSentenceStart)
      // advance by the audioDuration (500ms)
      vi.advanceTimersByTime(500);

      expect(eventEmitter).toHaveBeenCalledWith(
        WsChatEventNames.AUDIO_SENTENCE_PLAYBACK_START,
        expect.objectContaining({
          data: expect.objectContaining({ id: 's2' }),
        }),
      );
    });

    it('emits sentence end when last sentence finishes', () => {
      synchronizer.handleSentenceStart(makeSentenceStartEvent('s1', 'Only'));
      synchronizer['sentenceList'][0].audioDuration = 300;
      synchronizer['sentenceList'][0].isDurationFinish = true;
      synchronizer['sentenceList'][0].isLastSentence = true;

      eventEmitter.mockClear();

      // Clear existing timer and reschedule
      if (synchronizer['sentenceSwitchTimer']) {
        clearTimeout(synchronizer['sentenceSwitchTimer']);
      }
      synchronizer['scheduleSentenceSwitch']();

      vi.advanceTimersByTime(350);

      expect(eventEmitter).toHaveBeenCalledWith(
        WsChatEventNames.AUDIO_SENTENCE_PLAYBACK_ENDED,
        expect.objectContaining({ event_type: ClientEventType.AUDIO_SENTENCE_PLAYBACK_ENDED }),
      );
    });

    it('polls every 100ms when isDurationFinish is false', () => {
      synchronizer.handleSentenceStart(makeSentenceStartEvent('s1', 'First'));

      // isDurationFinish is false for the first sentence (no second sentence added yet)
      eventEmitter.mockClear();

      vi.advanceTimersByTime(100);
      // Still polling, not switched
      expect(synchronizer['currentSentenceIndex']).toBe(0);

      vi.advanceTimersByTime(100);
      expect(synchronizer['currentSentenceIndex']).toBe(0);
    });
  });
});
