// Fast and lightweight audio processing utilities
// Optimized for speed over advanced features

export interface AudioQualityMetrics {
    snr: number;
    rms: number;
    peak: number;
    duration: number;
    sampleRate: number;
    channels: number;
}

export class FastAudioProcessor {
    /**
     * Quick audio processing with minimal overhead
     */
    async processAudioBuffer(audioBuffer: AudioBuffer): Promise<{
        processedBuffer: AudioBuffer;
        metrics: AudioQualityMetrics;
    }> {
        console.log('Starting fast audio processing...');
        const startTime = performance.now();

        // Convert to mono if needed (simplified)
        const processedBuffer = this.convertToMono(audioBuffer);
        
        // Calculate basic metrics quickly
        const metrics = this.calculateBasicMetrics(processedBuffer);
        
        const processingTime = performance.now() - startTime;
        console.log(`Fast audio processing completed in ${processingTime.toFixed(2)}ms`);
        
        return {
            processedBuffer,
            metrics
        };
    }

    /**
     * Fast mono conversion
     */
    private convertToMono(audioBuffer: AudioBuffer): AudioBuffer {
        if (audioBuffer.numberOfChannels === 1) {
            return audioBuffer;
        }

        const audioContext = new AudioContext({ sampleRate: audioBuffer.sampleRate });
        const monoBuffer = audioContext.createBuffer(
            1,
            audioBuffer.length,
            audioBuffer.sampleRate
        );

        const monoData = monoBuffer.getChannelData(0);
        const leftChannel = audioBuffer.getChannelData(0);
        const rightChannel = audioBuffer.getChannelData(1);
        
        // Simple stereo to mono conversion
        for (let i = 0; i < audioBuffer.length; i++) {
            monoData[i] = (leftChannel[i] + rightChannel[i]) * 0.5;
        }

        return monoBuffer;
    }

    /**
     * Calculate basic metrics with minimal computation
     */
    private calculateBasicMetrics(audioBuffer: AudioBuffer): AudioQualityMetrics {
        const data = audioBuffer.getChannelData(0);
        let sum = 0;
        let peak = 0;
        
        // Sample every 1000th point for very fast calculation
        const step = Math.max(1, Math.floor(data.length / 500));
        let sampleCount = 0;
        
        for (let i = 0; i < data.length; i += step) {
            const sample = Math.abs(data[i]);
            sum += sample * sample;
            peak = Math.max(peak, sample);
            sampleCount++;
        }
        
        const rms = Math.sqrt(sum / sampleCount);
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
}

// Audio format detection (simplified)
export function detectAudioFormat(mimeType: string): string {
    // Formats audio
    if (mimeType.includes('wav')) return 'wav';
    if (mimeType.includes('mp3')) return 'mp3';
    if (mimeType.includes('flac')) return 'flac';
    if (mimeType.includes('ogg')) return 'ogg';
    if (mimeType.includes('m4a')) return 'm4a';
    
    // Formats vidéo (l'audio sera extrait)
    if (mimeType.includes('mp4')) return 'mp4';
    if (mimeType.includes('webm')) return 'webm';
    if (mimeType.includes('avi')) return 'avi';
    if (mimeType.includes('mov')) return 'mov';
    if (mimeType.includes('mkv')) return 'mkv';
    
    return 'unknown';
}

// Enhanced timestamp formatting (from original AudioUtils)
export function formatAudioTimestamp(
    seconds: number,
    alwaysIncludeHours = false,
): string {
    if (seconds < 60 && !alwaysIncludeHours) {
        return `0:${seconds.toFixed(1).padStart(4, '0')}`;
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);

    if (hours > 0 || alwaysIncludeHours) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs
            .toString()
            .padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
    } else {
        return `${minutes}:${secs
            .toString()
            .padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
    }
}

export function formatAudioTimestampSeconds(seconds: number): string {
    return `${seconds.toFixed(1)}s`;
}