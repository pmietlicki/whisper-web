// src/types/transcriber.ts

export interface Chunk {
    text: string;
    timestamp: [number, number | null];
    speaker?: string;
    confidence?: number;
}

export interface SpeakerSegment {
    label: string;
    start: number;
    end: number;
}

export interface TranscriberData {
    chunks: Chunk[];
    speakerSegments?: SpeakerSegment[];
    isBusy: boolean;
    tps?: number; // Tokens Per Second
}