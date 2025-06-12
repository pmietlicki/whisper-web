// Optimized Audio Processing Utilities
// Inspired by whisper-speaker-diarization project optimizations

const HOURS_IN_SECONDS = 3600;
const MINUTES_IN_SECONDS = 60;

// Audio processing configuration
export interface AudioProcessingConfig {
    sampleRate: number;
    channels: number;
    bitDepth: number;
    enableNormalization: boolean;
    enableNoiseReduction: boolean;
    chunkSize: number;
    overlap: number;
}

// Default optimized configuration - simplified for speed
export const DEFAULT_AUDIO_CONFIG: AudioProcessingConfig = {
    sampleRate: 16000, // Optimized for Whisper
    channels: 1, // Mono for better performance
    bitDepth: 16,
    enableNormalization: false, // Disabled for speed
    enableNoiseReduction: false, // Disabled for speed
    chunkSize: 30, // 30 seconds chunks
    overlap: 0.1 // 10% overlap
};

// Audio quality metrics
export interface AudioQualityMetrics {
    snr: number; // Signal-to-noise ratio
    rms: number; // Root mean square
    peak: number; // Peak amplitude
    duration: number;
    sampleRate: number;
    channels: number;
}

// Enhanced audio processing class
export class OptimizedAudioProcessor {
    private config: AudioProcessingConfig;
    private audioContext: AudioContext;

    constructor(config: Partial<AudioProcessingConfig> = {}) {
        this.config = { ...DEFAULT_AUDIO_CONFIG, ...config };
        this.audioContext = new AudioContext({
            sampleRate: this.config.sampleRate
        });
    }

    /**
     * Process audio buffer with optimizations
     */
    async processAudioBuffer(audioBuffer: AudioBuffer): Promise<{
        processedBuffer: AudioBuffer;
        metrics: AudioQualityMetrics;
        chunks: Float32Array[];
    }> {
        console.log('Starting optimized audio processing...');
        const startTime = performance.now();

        // Convert to mono if needed
        const monoBuffer = this.convertToMono(audioBuffer);
        
        // Apply audio enhancements
        const enhancedBuffer = await this.enhanceAudio(monoBuffer);
        
        // Calculate quality metrics
        const metrics = this.calculateQualityMetrics(enhancedBuffer);
        
        // Create optimized chunks for processing
        const chunks = this.createOptimizedChunks(enhancedBuffer);
        
        const processingTime = performance.now() - startTime;
        console.log(`Audio processing completed in ${processingTime.toFixed(2)}ms`);
        
        return {
            processedBuffer: enhancedBuffer,
            metrics,
            chunks
        };
    }

    /**
     * Convert stereo to mono for better performance
     */
    private convertToMono(audioBuffer: AudioBuffer): AudioBuffer {
        if (audioBuffer.numberOfChannels === 1) {
            return audioBuffer;
        }

        const monoBuffer = this.audioContext.createBuffer(
            1,
            audioBuffer.length,
            audioBuffer.sampleRate
        );

        const monoData = monoBuffer.getChannelData(0);
        
        // Mix all channels to mono
        for (let i = 0; i < audioBuffer.length; i++) {
            let sum = 0;
            for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
                sum += audioBuffer.getChannelData(channel)[i];
            }
            monoData[i] = sum / audioBuffer.numberOfChannels;
        }

        return monoBuffer;
    }

    /**
     * Apply audio enhancements (normalization, noise reduction)
     */
    private async enhanceAudio(audioBuffer: AudioBuffer): Promise<AudioBuffer> {
        const channelData = audioBuffer.getChannelData(0);
        const enhancedData = new Float32Array(channelData.length);
        
        // Copy original data
        enhancedData.set(channelData);
        
        if (this.config.enableNormalization) {
            this.normalizeAudio(enhancedData);
        }
        
        if (this.config.enableNoiseReduction) {
            this.applyNoiseReduction(enhancedData);
        }
        
        // Create new buffer with enhanced data
        const enhancedBuffer = this.audioContext.createBuffer(
            1,
            audioBuffer.length,
            audioBuffer.sampleRate
        );
        
        enhancedBuffer.getChannelData(0).set(enhancedData);
        return enhancedBuffer;
    }

    /**
     * Normalize audio levels
     */
    private normalizeAudio(data: Float32Array): void {
        let max = 0;
        for (let i = 0; i < data.length; i++) {
            max = Math.max(max, Math.abs(data[i]));
        }
        
        if (max > 0) {
            const scale = 0.95 / max; // Leave some headroom
            for (let i = 0; i < data.length; i++) {
                data[i] *= scale;
            }
        }
    }

    /**
     * Apply basic noise reduction using high-pass filter
     */
    private applyNoiseReduction(data: Float32Array): void {
        // Simple high-pass filter to remove low-frequency noise
        const alpha = 0.95;
        let prev = 0;
        
        for (let i = 0; i < data.length; i++) {
            const current = data[i];
            data[i] = alpha * (prev + current - data[i]);
            prev = current;
        }
    }

    /**
     * Calculate audio quality metrics (simplified for speed)
     */
    private calculateQualityMetrics(audioBuffer: AudioBuffer): AudioQualityMetrics {
        const data = audioBuffer.getChannelData(0);
        let rms = 0;
        let peak = 0;
        
        // Sample only every 100th point for speed
        const step = Math.max(1, Math.floor(data.length / 1000));
        let sampleCount = 0;
        
        for (let i = 0; i < data.length; i += step) {
            const sample = Math.abs(data[i]);
            rms += sample * sample;
            peak = Math.max(peak, sample);
            sampleCount++;
        }
        
        rms = Math.sqrt(rms / sampleCount);
        
        // Simplified SNR estimation
        const snr = rms > 0 ? 20 * Math.log10(peak / rms) : 60;
        
        return {
            snr,
            rms,
            peak,
            duration: audioBuffer.duration,
            sampleRate: audioBuffer.sampleRate,
            channels: audioBuffer.numberOfChannels
        };
    }

    /**
     * Create optimized chunks for processing (simplified)
     */
    private createOptimizedChunks(audioBuffer: AudioBuffer): Float32Array[] {
        const data = audioBuffer.getChannelData(0);
        
        // For speed, just return the whole audio as one chunk
        // This avoids the overhead of chunking for most use cases
        return [data.slice()];
    }

    /**
     * Resample audio to target sample rate
     */
    async resampleAudio(audioBuffer: AudioBuffer, targetSampleRate: number): Promise<AudioBuffer> {
        if (audioBuffer.sampleRate === targetSampleRate) {
            return audioBuffer;
        }

        const offlineContext = new OfflineAudioContext(
            audioBuffer.numberOfChannels,
            Math.floor(audioBuffer.duration * targetSampleRate),
            targetSampleRate
        );

        const source = offlineContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(offlineContext.destination);
        source.start();

        return await offlineContext.startRendering();
    }

    /**
     * Get optimal processing configuration based on audio characteristics
     */
    getOptimalConfig(audioBuffer: AudioBuffer): AudioProcessingConfig {
        const duration = audioBuffer.duration;
        const sampleRate = audioBuffer.sampleRate;
        
        // Adjust chunk size based on duration
        let chunkSize = this.config.chunkSize;
        if (duration < 60) {
            chunkSize = Math.min(15, duration / 2); // Smaller chunks for short audio
        } else if (duration > 300) {
            chunkSize = 45; // Larger chunks for long audio
        }
        
        return {
            ...this.config,
            chunkSize,
            sampleRate: Math.min(sampleRate, 16000) // Cap at 16kHz for efficiency
        };
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        if (this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
    }
}

// Utility functions for timestamp formatting (enhanced)
function padTime(time: number, padding: number = 2): string {
    return String(time).padStart(padding, "0");
}

function formatTimestamp(time: number) {
    const hours = Math.floor(time / HOURS_IN_SECONDS);
    const hoursRemainder = time - hours * HOURS_IN_SECONDS;

    const minutes = Math.floor(hoursRemainder / MINUTES_IN_SECONDS);
    const minutesRemainder = hoursRemainder - minutes * MINUTES_IN_SECONDS;

    const seconds = Math.floor(minutesRemainder);
    const secondsRemainder = minutesRemainder - seconds;

    const milliseconds = Math.floor(secondsRemainder * 1000);

    return { hours, minutes, seconds, milliseconds };
}

export function formatAudioTimestamp(time: number): string {
    const { hours, minutes, seconds } = formatTimestamp(time);

    // Hide hours if not needed
    const hoursString = hours ? padTime(hours) + ":" : "";
    const minutesString = padTime(minutes) + ":";
    const secondsString = padTime(seconds);

    return `${hoursString}${minutesString}${secondsString}`;
}

function formatSrtTimestamp(time: number): string {
    const { hours, minutes, seconds, milliseconds } = formatTimestamp(time);

    const hoursString = padTime(hours) + ":";
    const minutesString = padTime(minutes) + ":";
    const secondsString = padTime(seconds) + ",";
    const millisecondsString = padTime(milliseconds, 3);

    return `${hoursString}${minutesString}${secondsString}${millisecondsString}`;
}

export function formatSrtTimeRange(start: number, end: number): string {
    return `${formatSrtTimestamp(start)} --> ${formatSrtTimestamp(end)}`;
}

// Audio format detection and validation
export function detectAudioFormat(arrayBuffer: ArrayBuffer): string {
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Check for common audio file signatures
    if (uint8Array[0] === 0x52 && uint8Array[1] === 0x49 && uint8Array[2] === 0x46 && uint8Array[3] === 0x46) {
        return 'wav';
    }
    if (uint8Array[0] === 0xFF && (uint8Array[1] & 0xE0) === 0xE0) {
        return 'mp3';
    }
    if (uint8Array[0] === 0x66 && uint8Array[1] === 0x4C && uint8Array[2] === 0x61 && uint8Array[3] === 0x43) {
        return 'flac';
    }
    if (uint8Array[0] === 0x4F && uint8Array[1] === 0x67 && uint8Array[2] === 0x67 && uint8Array[3] === 0x53) {
        return 'ogg';
    }
    
    return 'unknown';
}

// Performance monitoring
export class AudioProcessingProfiler {
    private static instance: AudioProcessingProfiler;
    private metrics: Map<string, number[]> = new Map();

    static getInstance(): AudioProcessingProfiler {
        if (!AudioProcessingProfiler.instance) {
            AudioProcessingProfiler.instance = new AudioProcessingProfiler();
        }
        return AudioProcessingProfiler.instance;
    }

    startTiming(operation: string): () => void {
        const startTime = performance.now();
        return () => {
            const duration = performance.now() - startTime;
            this.addMetric(operation, duration);
        };
    }

    addMetric(operation: string, duration: number): void {
        if (!this.metrics.has(operation)) {
            this.metrics.set(operation, []);
        }
        this.metrics.get(operation)!.push(duration);
    }

    getAverageTime(operation: string): number {
        const times = this.metrics.get(operation);
        if (!times || times.length === 0) return 0;
        return times.reduce((sum, time) => sum + time, 0) / times.length;
    }

    getMetrics(): Record<string, { average: number; count: number; total: number }> {
        const result: Record<string, { average: number; count: number; total: number }> = {};
        
        for (const [operation, times] of this.metrics.entries()) {
            const total = times.reduce((sum, time) => sum + time, 0);
            result[operation] = {
                average: total / times.length,
                count: times.length,
                total
            };
        }
        
        return result;
    }

    reset(): void {
        this.metrics.clear();
    }
}