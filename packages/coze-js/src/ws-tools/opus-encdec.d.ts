declare module 'opus-encdec/src/oggOpusDecoder.js' {
  interface OggOpusDecoderConfig {
    rawOpus?: boolean;
    numberOfChannels?: number;
    decoderSampleRate?: number;
    outputBufferSampleRate?: number;
    resampleQuality?: number;
    mimeType?: string;
  }

  class OggOpusDecoder {
    constructor(config: OggOpusDecoderConfig, module: unknown);
    isReady: boolean;
    onready?: () => void;
    decodeRaw(data: Uint8Array, callback: (output: Float32Array) => void): void;
    destroy(): void;
  }

  export { OggOpusDecoder };
}

declare module 'opus-encdec/src/oggOpusEncoder.js' {
  interface OggOpusEncoderConfig {
    encoderApplication?: number;
    encoderFrameSize?: number;
    encoderSampleRate?: number;
    numberOfChannels?: number;
    rawOpus?: boolean;
    originalSampleRate?: number;
    maxFramesPerPage?: number;
    serial?: number;
    mimeType?: string;
  }

  class OggOpusEncoder {
    constructor(config: OggOpusEncoderConfig, module: unknown);
    isReady: boolean;
    onready?: (value: unknown) => void;
    encodedData: Uint8Array[];
    encode(data: Float32Array[]): void;
    destroy(): void;
  }

  export { OggOpusEncoder };
}

declare module 'opus-encdec/dist/libopus-decoder.js' {
  const lib: unknown;
  export default lib;
}

declare module 'opus-encdec/dist/libopus-encoder.js' {
  const lib: unknown;
  export default lib;
}
