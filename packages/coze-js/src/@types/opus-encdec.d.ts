declare module 'opus-encdec/src/oggOpusDecoder.js' {
  interface OggOpusDecoderConfig {
    rawOpus?: boolean;
    numberOfChannels?: number;
    decoderSampleRate?: number;
    outputBufferSampleRate?: number;
    resampleQuality?: number;
    mimeType?: string;
    onInit?: () => void;
    onComplete?: () => void;
  }

  class OggOpusDecoder {
    isReady: boolean;
    onready?: () => void;
    constructor(config: OggOpusDecoderConfig, module: unknown);
    decode(typedArray: Uint8Array, onDecoded?: (outputBuffer: Float32Array) => void): void;
    decodeRaw(typedArray: Uint8Array, onDecoded?: (outputBuffer: Float32Array) => void): void;
    destroy(): void;
    init(): void;
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
    resampleQuality?: number;
    mimeType?: string;
  }

  class OggOpusEncoder {
    isReady: boolean;
    onready?: (resolve?: unknown) => void;
    encodedData: Uint8Array[];
    encodedDataLength: number;
    constructor(config: OggOpusEncoderConfig, module: unknown);
    encode(buffers: Float32Array[]): void;
    flush(): void;
    destroy(): void;
  }

  export { OggOpusEncoder };
}

declare module 'opus-encdec/dist/libopus-decoder.js' {
  const OpusDecoderLib: unknown;
  export default OpusDecoderLib;
}

declare module 'opus-encdec/dist/libopus-encoder.js' {
  const OpusEncoderLib: unknown;
  export default OpusEncoderLib;
}
