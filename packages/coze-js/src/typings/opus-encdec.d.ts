interface OggOpusDecoderConfig {
  rawOpus?: boolean;
  numberOfChannels?: number;
  decoderSampleRate?: number;
  outputBufferSampleRate?: number;
  resampleQuality?: number;
  mimeType?: string;
}

interface OggOpusEncoderConfig {
  encoderApplication?: number;
  encoderFrameSize?: number;
  encoderSampleRate?: number;
  numberOfChannels?: number;
  rawOpus?: boolean;
  originalSampleRate?: number;
  maxFramesPerPage?: number;
  resampleQuality?: number;
  serial?: number;
  mimeType?: string;
}

declare class OggOpusDecoder {
  isReady: boolean;
  onready: (() => void) | undefined;
  constructor(config: OggOpusDecoderConfig, module: object);
  decodeRaw(data: Uint8Array, callback: (outputBuffer: Float32Array) => void): void;
  destroy(): void;
}

declare class OggOpusEncoder {
  isReady: boolean;
  onready: ((value: unknown) => void) | undefined;
  encodedData: Uint8Array[] | undefined;
  constructor(config: OggOpusEncoderConfig, module: object);
  encode(frames: Float32Array[]): void;
  destroy(): void;
}

declare module 'opus-encdec/src/oggOpusDecoder.js' {
  export { OggOpusDecoder };
}

declare module 'opus-encdec/src/oggOpusEncoder.js' {
  export { OggOpusEncoder };
}

declare module 'opus-encdec/dist/libopus-decoder.js' {
  const module: object;
  export default module;
}

declare module 'opus-encdec/dist/libopus-encoder.js' {
  const module: object;
  export default module;
}
