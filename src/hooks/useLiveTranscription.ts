import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWorker } from "./useWorker";
import Constants from "../utils/Constants";

export type LiveEngine = "local" | "websocket";
type LiveServerProtocol = "auto" | "whisperlivekit" | "whisperlive";
type LiveStatus =
    | "idle"
    | "connecting"
    | "listening"
    | "processing"
    | "stopping"
    | "error";

interface ProgressItem {
    file: string;
    loaded?: number;
    progress?: number;
    total?: number;
    name?: string;
    status: string;
}

export interface LiveCaptionLine {
    id: string;
    text: string;
    start: number;
    end: number;
    speaker?: string;
}

interface AudioChunk {
    start: number;
    data: Float32Array;
}

interface AudioBufferState {
    chunks: AudioChunk[];
    totalSamples: number;
}

interface LocalSegment {
    id: string;
    audio: Float32Array;
    start: number;
    end: number;
    rms: number;
    sessionId: number;
}

interface WorkerTranscriptChunk {
    text: string;
    timestamp: [number, number | null];
}

interface WorkerTranscriptData {
    text?: string;
    chunks?: WorkerTranscriptChunk[];
    tps?: number;
}

interface WhisperLiveKitLine {
    speaker?: number | string;
    text?: string | null;
    start?: string | number;
    end?: string | number;
    completed?: boolean;
}

interface WhisperLiveKitMessage {
    type?: "config" | "snapshot" | "diff" | "ready_to_stop" | string;
    status?: string;
    useAudioWorklet?: boolean;
    mode?: string;
    uid?: string;
    message?: string | number;
    backend?: string;
    language?: string;
    model?: string;
    lines?: WhisperLiveKitLine[];
    new_lines?: WhisperLiveKitLine[];
    segments?: WhisperLiveKitLine[];
    translated_segments?: WhisperLiveKitLine[];
    lines_pruned?: number;
    n_lines?: number;
    text?: string;
    buffer_transcription?: string;
    remaining_time_transcription?: number;
    error?: string;
    channel?: {
        alternatives?: Array<{
            transcript?: string;
        }>;
    };
    is_final?: boolean;
    speech_final?: boolean;
    start?: number;
    duration?: number;
}

interface UseLiveTranscriptionOptions {
    language: string;
}

export interface LiveTranscriptionState {
    availableEngines: LiveEngine[];
    engine: LiveEngine;
    setEngine: (engine: LiveEngine) => void;
    status: LiveStatus;
    isRunning: boolean;
    isSupported: boolean;
    isModelLoading: boolean;
    progressItems: ProgressItem[];
    error?: string;
    warning?: string;
    lines: LiveCaptionLine[];
    interimText: string;
    captionText: string;
    elapsedSeconds: number;
    latencySeconds?: number;
    inputLevel: number;
    queueDepth: number;
    model: string;
    language: string;
    start: () => Promise<void>;
    stop: () => void;
    reset: () => void;
}

const LIVE_SEGMENT_SECONDS = 4;
const LIVE_OVERLAP_SECONDS = 1;
const LOCAL_QUEUE_LIMIT = 2;
const SILENCE_RMS_THRESHOLD = 0.006;

function firstNonEmpty(...values: Array<string | undefined>) {
    return values.map((value) => value?.trim()).find(Boolean);
}

function getRuntimeConfig() {
    if (typeof window === "undefined") {
        return undefined;
    }
    return window.__WHISPER_WEB_CONFIG__;
}

const RUNTIME_CONFIG = getRuntimeConfig();
const LIVE_WS_URL = firstNonEmpty(
    RUNTIME_CONFIG?.liveTranscriptionWsUrl,
    import.meta.env.VITE_LIVE_TRANSCRIPTION_WS_URL,
);
const LIVE_SERVER_PROTOCOL = normalizeLiveServerProtocol(
    firstNonEmpty(
        RUNTIME_CONFIG?.liveTranscriptionServer,
        import.meta.env.VITE_LIVE_TRANSCRIPTION_SERVER,
    ),
);
const LIVE_SERVER_MODEL =
    firstNonEmpty(
        RUNTIME_CONFIG?.liveTranscriptionModel,
        import.meta.env.VITE_LIVE_TRANSCRIPTION_MODEL,
    ) || "small";

function getAudioContextConstructor(): typeof AudioContext | undefined {
    const windowWithAudioContext = window as Window & {
        AudioContext?: typeof AudioContext;
        webkitAudioContext?: typeof AudioContext;
    };
    return (
        windowWithAudioContext.AudioContext ??
        windowWithAudioContext.webkitAudioContext
    );
}

function getBaseLanguage(language: string): string {
    return language.split("-")[0].toLowerCase();
}

function isLiveSupported() {
    return Boolean(
        typeof navigator.mediaDevices?.getUserMedia === "function" &&
            getAudioContextConstructor() &&
            typeof window.Worker === "function",
    );
}

function cleanText(text?: string | null) {
    return (text ?? "").replace(/\s+/g, " ").trim();
}

function normalizeLiveServerProtocol(
    value: string | undefined,
): LiveServerProtocol {
    const normalized = value?.trim().toLowerCase();
    if (normalized === "whisperlivekit" || normalized === "wlk") {
        return "whisperlivekit";
    }
    if (normalized === "whisperlive" || normalized === "classic") {
        return "whisperlive";
    }
    return "auto";
}

function normalizeToken(token: string) {
    return token
        .toLocaleLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\p{L}\p{N}]+/gu, "");
}

function removeCommittedOverlap(committedText: string, incomingText: string) {
    const incomingTokens = cleanText(incomingText).split(/\s+/).filter(Boolean);
    if (incomingTokens.length === 0) return "";

    const committedTokens = cleanText(committedText).split(/\s+/).filter(Boolean);
    const maxOverlap = Math.min(14, incomingTokens.length, committedTokens.length);

    for (let size = maxOverlap; size > 0; size--) {
        const committedTail = committedTokens
            .slice(-size)
            .map(normalizeToken)
            .join(" ");
        const incomingHead = incomingTokens
            .slice(0, size)
            .map(normalizeToken)
            .join(" ");

        if (committedTail && committedTail === incomingHead) {
            return incomingTokens.slice(size).join(" ");
        }
    }

    const normalizedCommitted = normalizeToken(committedText);
    const normalizedIncoming = normalizeToken(incomingText);
    if (normalizedIncoming && normalizedCommitted.endsWith(normalizedIncoming)) {
        return "";
    }

    return incomingTokens.join(" ");
}

function parseTimestamp(value: string | number | undefined) {
    if (typeof value === "number") return value;
    if (!value) return 0;

    const parts = value.split(":").map(Number);
    if (parts.some(Number.isNaN)) return 0;
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    }
    return parts[0] ?? 0;
}

function calculateRms(samples: Float32Array) {
    if (samples.length === 0) return 0;

    let sum = 0;
    const step = Math.max(1, Math.floor(samples.length / 4000));
    let count = 0;

    for (let index = 0; index < samples.length; index += step) {
        const sample = samples[index];
        sum += sample * sample;
        count++;
    }

    return Math.sqrt(sum / Math.max(1, count));
}

function appendSamples(
    state: AudioBufferState,
    samples: Float32Array,
): AudioBufferState {
    return {
        chunks: [...state.chunks, { start: state.totalSamples, data: samples }],
        totalSamples: state.totalSamples + samples.length,
    };
}

function sliceSamples(
    state: AudioBufferState,
    startSample: number,
    endSample: number,
) {
    const length = Math.max(0, endSample - startSample);
    const output = new Float32Array(length);
    let writeOffset = 0;

    for (const chunk of state.chunks) {
        const chunkStart = chunk.start;
        const chunkEnd = chunk.start + chunk.data.length;
        if (chunkEnd <= startSample || chunkStart >= endSample) continue;

        const readStart = Math.max(startSample, chunkStart) - chunkStart;
        const readEnd = Math.min(endSample, chunkEnd) - chunkStart;
        output.set(chunk.data.subarray(readStart, readEnd), writeOffset);
        writeOffset += readEnd - readStart;
    }

    return output;
}

function pruneSamples(state: AudioBufferState, beforeSample: number) {
    return {
        chunks: state.chunks.filter(
            (chunk) => chunk.start + chunk.data.length > beforeSample,
        ),
        totalSamples: state.totalSamples,
    };
}

function resampleLinear(
    samples: Float32Array,
    sourceRate: number,
    targetRate: number,
) {
    if (sourceRate === targetRate) return samples;

    const ratio = sourceRate / targetRate;
    const outputLength = Math.max(1, Math.round(samples.length / ratio));
    const output = new Float32Array(outputLength);

    for (let index = 0; index < outputLength; index++) {
        const sourceIndex = index * ratio;
        const leftIndex = Math.floor(sourceIndex);
        const rightIndex = Math.min(leftIndex + 1, samples.length - 1);
        const weight = sourceIndex - leftIndex;
        output[index] =
            samples[leftIndex] * (1 - weight) + samples[rightIndex] * weight;
    }

    return output;
}

function floatToPcm16(samples: Float32Array) {
    const buffer = new ArrayBuffer(samples.length * 2);
    const view = new DataView(buffer);

    for (let index = 0; index < samples.length; index++) {
        const clamped = Math.max(-1, Math.min(1, samples[index]));
        view.setInt16(
            index * 2,
            clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff,
            true,
        );
    }

    return buffer;
}

function float32SamplesToBuffer(samples: Float32Array) {
    if (
        samples.byteOffset === 0 &&
        samples.byteLength === samples.buffer.byteLength
    ) {
        return samples.buffer;
    }

    return samples.buffer.slice(
        samples.byteOffset,
        samples.byteOffset + samples.byteLength,
    );
}

function resolveLiveServerProtocol(baseUrl: string): Exclude<
    LiveServerProtocol,
    "auto"
> {
    const url = new URL(baseUrl, window.location.href);
    if (LIVE_SERVER_PROTOCOL !== "auto") return LIVE_SERVER_PROTOCOL;

    const pathname = url.pathname.toLowerCase();
    if (pathname.includes("/asr") || pathname.includes("/v1/listen")) {
        return "whisperlivekit";
    }

    return "whisperlive";
}

function makeWebSocketUrl(
    baseUrl: string,
    language: string,
    protocol: Exclude<LiveServerProtocol, "auto">,
) {
    const url = new URL(baseUrl, window.location.href);

    if (protocol === "whisperlive") {
        return url.toString();
    }

    url.searchParams.set("language", getBaseLanguage(language) || "fr");
    if (!url.searchParams.has("mode")) {
        url.searchParams.set("mode", "diff");
    }
    return url.toString();
}

function makeLiveSessionId() {
    if (typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return `whisper-web-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeWhisperLiveConfig(uid: string, language: string) {
    return {
        uid,
        language: getBaseLanguage(language) || "fr",
        task: "transcribe",
        model: LIVE_SERVER_MODEL,
        use_vad: true,
        send_last_n_segments: 10,
        no_speech_thresh: 0.45,
        clip_audio: false,
        same_output_threshold: 10,
        enable_translation: false,
    };
}

function makeLineFromWhisperLiveKit(
    line: WhisperLiveKitLine,
    index: number,
): LiveCaptionLine | null {
    const text = cleanText(line.text);
    if (!text || line.speaker === -2) return null;

    const start = parseTimestamp(line.start);
    const end = Math.max(start, parseTimestamp(line.end));
    return {
        id: `ws-${index}-${start}-${end}-${text}`,
        text,
        start,
        end,
        speaker:
            line.speaker !== undefined ? String(line.speaker) : undefined,
    };
}

function makeLineFromWhisperLiveSegment(
    line: WhisperLiveKitLine,
    index: number,
): LiveCaptionLine | null {
    const captionLine = makeLineFromWhisperLiveKit(line, index);
    if (!captionLine) return null;
    return {
        ...captionLine,
        id: `wl-${index}-${captionLine.start}-${captionLine.end}-${captionLine.text}`,
    };
}

function mergeCaptionLines(
    currentLines: LiveCaptionLine[],
    incomingLines: LiveCaptionLine[],
) {
    const merged = [...currentLines];

    for (const incomingLine of incomingLines) {
        const existingIndex = merged.findIndex(
            (line) =>
                line.id === incomingLine.id ||
                (line.start === incomingLine.start &&
                    line.end === incomingLine.end &&
                    line.text === incomingLine.text),
        );

        if (existingIndex >= 0) {
            merged[existingIndex] = incomingLine;
        } else {
            merged.push(incomingLine);
        }
    }

    return merged.slice(-120);
}

export function useLiveTranscription({
    language,
}: UseLiveTranscriptionOptions): LiveTranscriptionState {
    const availableEngines = useMemo<LiveEngine[]>(
        () => (LIVE_WS_URL ? ["local", "websocket"] : ["local"]),
        [],
    );
    const [engine, setEngineState] = useState<LiveEngine>("local");
    const [status, setStatus] = useState<LiveStatus>("idle");
    const [error, setError] = useState<string>();
    const [warning, setWarning] = useState<string>();
    const [lines, setLines] = useState<LiveCaptionLine[]>([]);
    const [interimText, setInterimText] = useState("");
    const [inputLevel, setInputLevel] = useState(0);
    const [queueDepth, setQueueDepth] = useState(0);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [latencySeconds, setLatencySeconds] = useState<number>();
    const [isModelLoading, setIsModelLoading] = useState(false);
    const [progressItems, setProgressItems] = useState<ProgressItem[]>([]);

    const linesRef = useRef<LiveCaptionLine[]>([]);
    const committedTextRef = useRef("");
    const transcriptStartRef = useRef(0);
    const audioBufferRef = useRef<AudioBufferState>({
        chunks: [],
        totalSamples: 0,
    });
    const lastEnqueuedSampleRef = useRef(0);
    const sampleRateRef = useRef(Constants.SAMPLING_RATE);
    const streamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const websocketRef = useRef<WebSocket | null>(null);
    const localQueueRef = useRef<LocalSegment[]>([]);
    const localBusyRef = useRef(false);
    const activeSegmentRef = useRef<LocalSegment | null>(null);
    const sessionIdRef = useRef(0);
    const processNextLocalRef = useRef<() => void>(() => {});
    const webWorkerRef = useRef<Worker | null>(null);
    const isRunningRef = useRef(false);
    const isModelLoadingRef = useRef(false);
    const elapsedTimerRef = useRef<number | undefined>(undefined);
    const wsLinesRef = useRef<LiveCaptionLine[]>([]);
    const whisperLiveUidRef = useRef<string | null>(null);
    const lagRecoveryCountRef = useRef(0);

    const model = useMemo(
        () => Constants.getDefaultLiveModel(language),
        [language],
    );
    const baseLanguage = useMemo(() => getBaseLanguage(language) || "fr", [
        language,
    ]);
    const isSupported = isLiveSupported();
    const isRunning =
        status === "connecting" ||
        status === "listening" ||
        status === "processing" ||
        status === "stopping";

    const setEngine = useCallback(
        (nextEngine: LiveEngine) => {
            if (!availableEngines.includes(nextEngine) || isRunningRef.current) {
                return;
            }
            setEngineState(nextEngine);
        },
        [availableEngines],
    );

    const updateLines = useCallback((nextLines: LiveCaptionLine[]) => {
        const cappedLines = nextLines.slice(-120);
        linesRef.current = cappedLines;
        committedTextRef.current = cappedLines.map((line) => line.text).join(" ");
        setLines(cappedLines);
    }, []);

    const reset = useCallback(() => {
        setLines([]);
        linesRef.current = [];
        wsLinesRef.current = [];
        committedTextRef.current = "";
        setInterimText("");
        setError(undefined);
        setWarning(undefined);
        setLatencySeconds(undefined);
        setQueueDepth(0);
        localQueueRef.current = [];
        lagRecoveryCountRef.current = 0;
    }, []);

    const cleanupAudio = useCallback(() => {
        processorRef.current?.disconnect();
        sourceRef.current?.disconnect();
        processorRef.current = null;
        sourceRef.current = null;

        if (mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.stop();
        }
        mediaRecorderRef.current = null;

        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        void audioContextRef.current?.close();
        audioContextRef.current = null;
    }, []);

    const cleanupWebSocket = useCallback(() => {
        const socket = websocketRef.current;
        websocketRef.current = null;
        whisperLiveUidRef.current = null;
        if (!socket) return;

        try {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(new ArrayBuffer(0));
            }
            socket.close();
        } catch {
            socket.close();
        }
    }, []);

    const stopElapsedTimer = useCallback(() => {
        if (elapsedTimerRef.current !== undefined) {
            window.clearInterval(elapsedTimerRef.current);
            elapsedTimerRef.current = undefined;
        }
    }, []);

    const stop = useCallback(() => {
        isRunningRef.current = false;
        setStatus((currentStatus) =>
            currentStatus === "idle" ? "idle" : "stopping",
        );
        cleanupAudio();
        cleanupWebSocket();
        stopElapsedTimer();
        setInputLevel(0);
        localQueueRef.current = [];
        setQueueDepth(0);
        setStatus("idle");
    }, [cleanupAudio, cleanupWebSocket, stopElapsedTimer]);

    const appendLocalTranscript = useCallback(
        (segment: LocalSegment, data: WorkerTranscriptData | undefined) => {
            const text = cleanText(data?.text);
            const dedupedText = removeCommittedOverlap(
                committedTextRef.current,
                text,
            );
            if (!dedupedText) {
                setInterimText("");
                return;
            }

            const firstChunk = data?.chunks?.find((chunk) => cleanText(chunk.text));
            const start =
                segment.start + (firstChunk?.timestamp?.[0] ?? 0);
            const end = Math.max(
                start,
                segment.start +
                    (firstChunk?.timestamp?.[1] ??
                        segment.end - segment.start),
            );
            const nextLine: LiveCaptionLine = {
                id: segment.id,
                text: dedupedText,
                start,
                end,
            };

            updateLines([...linesRef.current, nextLine]);
            setInterimText("");
            setLatencySeconds(
                Math.max(0, performance.now() / 1000 - transcriptStartRef.current - end),
            );
        },
        [updateLines],
    );

    const processNextLocal = useCallback(() => {
        if (localBusyRef.current) return;

        const segment = localQueueRef.current.shift();
        setQueueDepth(localQueueRef.current.length);
        if (!segment) {
            if (isRunningRef.current) {
                setStatus("listening");
            }
            return;
        }

        localBusyRef.current = true;
        activeSegmentRef.current = segment;
        setStatus("processing");

        const worker = webWorkerRef.current;
        if (!worker) {
            localBusyRef.current = false;
            return;
        }

        worker.postMessage({
            audio: segment.audio,
            model,
            dtype: Constants.DEFAULT_DTYPE,
            gpu: Constants.DEFAULT_GPU,
            subtask: "transcribe",
            language: baseLanguage,
            audioMetrics: {
                snr: segment.rms > 0 ? 20 * Math.log10(1 / segment.rms) : 60,
                rms: segment.rms,
                peak: 1,
                duration: segment.end - segment.start,
                sampleRate: Constants.SAMPLING_RATE,
                channels: 1,
            },
            token:
                import.meta.env.VITE_HF_AUTH_TOKEN ??
                import.meta.env.VITE_HF_TOKEN,
        });
    }, [baseLanguage, model]);

    useEffect(() => {
        processNextLocalRef.current = processNextLocal;
    }, [processNextLocal]);

    useEffect(() => {
        isModelLoadingRef.current = isModelLoading;
    }, [isModelLoading]);

    const clearLagWarningAfterStableProcessing = useCallback(() => {
        lagRecoveryCountRef.current += 1;
        if (lagRecoveryCountRef.current < 2) return;

        setWarning((currentWarning) =>
            currentWarning === "live.warning_lag" ? undefined : currentWarning,
        );
    }, []);

    const webWorker = useWorker((event) => {
        const message = event.data;
        const statusType = message.status ?? message.type;

        switch (statusType) {
            case "initiate":
                setIsModelLoading(true);
                setProgressItems((previousItems) => [
                    ...previousItems,
                    message,
                ]);
                break;
            case "progress":
                setProgressItems((previousItems) =>
                    previousItems.map((item) =>
                        item.file === message.file
                            ? { ...item, progress: message.progress }
                            : item,
                    ),
                );
                break;
            case "done":
                setProgressItems((previousItems) =>
                    previousItems.filter((item) => item.file !== message.file),
                );
                break;
            case "ready":
                setIsModelLoading(false);
                break;
            case "interim":
                setInterimText(cleanText(message.text ?? message.data?.text));
                break;
            case "complete": {
                const segment = activeSegmentRef.current;
                activeSegmentRef.current = null;
                localBusyRef.current = false;

                if (segment?.sessionId === sessionIdRef.current) {
                    appendLocalTranscript(segment, message.data);
                }

                clearLagWarningAfterStableProcessing();
                processNextLocalRef.current();
                break;
            }
            case "error":
                localBusyRef.current = false;
                activeSegmentRef.current = null;
                setIsModelLoading(false);
                setError(
                    message.data?.message ??
                        message.message ??
                        "Live transcription failed.",
                );
                setStatus("error");
                processNextLocalRef.current();
                break;
            default:
                break;
        }
    });

    useEffect(() => {
        webWorkerRef.current = webWorker;
    }, [webWorker]);

    const enqueueLocalSegment = useCallback(
        (samples: Float32Array, start: number, end: number, rms: number) => {
            if (rms < SILENCE_RMS_THRESHOLD) {
                setInterimText("");
                return;
            }

            const segment: LocalSegment = {
                id: `local-${sessionIdRef.current}-${start.toFixed(2)}`,
                audio: resampleLinear(
                    samples,
                    sampleRateRef.current,
                    Constants.SAMPLING_RATE,
                ),
                start,
                end,
                rms,
                sessionId: sessionIdRef.current,
            };

            if (localQueueRef.current.length >= LOCAL_QUEUE_LIMIT) {
                localQueueRef.current.shift();
                lagRecoveryCountRef.current = 0;
                if (!isModelLoadingRef.current) {
                    setWarning("live.warning_lag");
                }
            }

            localQueueRef.current.push(segment);
            setQueueDepth(localQueueRef.current.length);
            processNextLocalRef.current();
        },
        [],
    );

    const handlePcmSamples = useCallback(
        (
            samples: Float32Array,
            sourceSampleRate: number,
            sendFrame?: (samples: Float32Array) => void,
        ) => {
            sampleRateRef.current = sourceSampleRate;

            const rms = calculateRms(samples);
            setInputLevel((currentLevel) => currentLevel * 0.75 + rms * 0.25);

            if (sendFrame) {
                const resampled = resampleLinear(
                    samples,
                    sourceSampleRate,
                    Constants.SAMPLING_RATE,
                );
                sendFrame(resampled);
                return;
            }

            audioBufferRef.current = appendSamples(
                audioBufferRef.current,
                samples,
            );

            const segmentSamples = Math.round(
                LIVE_SEGMENT_SECONDS * sourceSampleRate,
            );
            const overlapSamples = Math.round(
                LIVE_OVERLAP_SECONDS * sourceSampleRate,
            );
            const totalSamples = audioBufferRef.current.totalSamples;

            if (totalSamples - lastEnqueuedSampleRef.current < segmentSamples) {
                return;
            }

            const startSample = Math.max(
                0,
                lastEnqueuedSampleRef.current - overlapSamples,
            );
            const endSample = totalSamples;
            const slice = sliceSamples(
                audioBufferRef.current,
                startSample,
                endSample,
            );
            const sliceRms = calculateRms(slice);

            enqueueLocalSegment(
                slice,
                startSample / sourceSampleRate,
                endSample / sourceSampleRate,
                sliceRms,
            );

            lastEnqueuedSampleRef.current = totalSamples;
            audioBufferRef.current = pruneSamples(
                audioBufferRef.current,
                Math.max(0, startSample - overlapSamples),
            );
        },
        [enqueueLocalSegment],
    );

    const startPcmCapture = useCallback(
        async (sendFrame?: (samples: Float32Array) => void) => {
            const AudioContextConstructor = getAudioContextConstructor();
            if (!AudioContextConstructor) {
                throw new Error("AudioContext is not supported by this browser.");
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1,
                },
            });
            const audioContext = new AudioContextConstructor();
            const source = audioContext.createMediaStreamSource(stream);
            const processor = audioContext.createScriptProcessor(4096, 1, 1);

            processor.onaudioprocess = (event) => {
                if (!isRunningRef.current) return;

                const input = event.inputBuffer.getChannelData(0);
                handlePcmSamples(
                    new Float32Array(input),
                    audioContext.sampleRate,
                    sendFrame,
                );
            };

            source.connect(processor);
            processor.connect(audioContext.destination);

            streamRef.current = stream;
            audioContextRef.current = audioContext;
            sourceRef.current = source;
            processorRef.current = processor;
        },
        [handlePcmSamples],
    );

    const startEncodedWebSocketCapture = useCallback(
        async (socket: WebSocket) => {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
            });
            const mimeTypes = [
                "audio/webm;codecs=opus",
                "audio/webm",
                "audio/mp4",
                "audio/ogg;codecs=opus",
            ];
            const mimeType = mimeTypes.find((type) =>
                MediaRecorder.isTypeSupported(type),
            );
            const recorder = new MediaRecorder(
                stream,
                mimeType ? { mimeType } : undefined,
            );

            recorder.addEventListener("dataavailable", async (event) => {
                if (
                    event.data.size === 0 ||
                    socket.readyState !== WebSocket.OPEN
                ) {
                    return;
                }
                socket.send(await event.data.arrayBuffer());
            });

            recorder.start(500);
            streamRef.current = stream;
            mediaRecorderRef.current = recorder;
        },
        [],
    );

    const applyWebSocketMessage = useCallback(
        (message: WhisperLiveKitMessage) => {
            if (
                message.uid &&
                whisperLiveUidRef.current &&
                message.uid !== whisperLiveUidRef.current
            ) {
                return;
            }

            if (message.error) {
                setError(message.error);
                setStatus("error");
                return;
            }

            if (message.status === "WAIT") {
                setWarning(
                    typeof message.message === "number"
                        ? `Serveur occupé, attente estimée ${message.message.toFixed(1)} min.`
                        : "Serveur de transcription occupé.",
                );
                return;
            }

            if (
                message.type === "ready_to_stop" ||
                message.message === "DISCONNECT"
            ) {
                setStatus("idle");
                return;
            }

            if (message.message === "SERVER_READY") {
                if (isRunningRef.current) {
                    setStatus("listening");
                }
                return;
            }

            if (Array.isArray(message.segments)) {
                const stableLines = message.segments
                    .filter((segment) => segment.completed !== false)
                    .map(makeLineFromWhisperLiveSegment)
                    .filter((line): line is LiveCaptionLine => Boolean(line));
                const activeSegment = [...message.segments]
                    .reverse()
                    .find((segment) => segment.completed === false);
                const nextLines = mergeCaptionLines(
                    wsLinesRef.current,
                    stableLines,
                );
                wsLinesRef.current = nextLines;
                updateLines(nextLines);
                setInterimText(cleanText(activeSegment?.text));
            } else if (message.type === "snapshot") {
                const nextLines = (message.lines ?? [])
                    .map(makeLineFromWhisperLiveKit)
                    .filter((line): line is LiveCaptionLine => Boolean(line));
                wsLinesRef.current = nextLines;
                updateLines(nextLines);
            } else if (message.type === "diff") {
                const pruned = message.lines_pruned ?? 0;
                if (pruned > 0) {
                    wsLinesRef.current = wsLinesRef.current.slice(pruned);
                }

                const newLines = (message.new_lines ?? [])
                    .map((line, index) =>
                        makeLineFromWhisperLiveKit(
                            line,
                            wsLinesRef.current.length + index,
                        ),
                    )
                    .filter((line): line is LiveCaptionLine => Boolean(line));
                wsLinesRef.current = [...wsLinesRef.current, ...newLines];
                updateLines(wsLinesRef.current);
            } else if (Array.isArray(message.lines)) {
                const nextLines = message.lines
                    .map(makeLineFromWhisperLiveKit)
                    .filter((line): line is LiveCaptionLine => Boolean(line));
                wsLinesRef.current = nextLines;
                updateLines(nextLines);
            } else if (message.channel?.alternatives?.[0]?.transcript) {
                const text = cleanText(
                    message.channel.alternatives[0].transcript,
                );
                if (message.is_final || message.speech_final) {
                    const start =
                        message.start ??
                        Math.max(
                            0,
                            performance.now() / 1000 -
                                transcriptStartRef.current,
                        );
                    const end = start + (message.duration ?? 0);
                    updateLines([
                        ...linesRef.current,
                        {
                            id: `dg-${Date.now()}`,
                            text,
                            start,
                            end,
                        },
                    ]);
                    setInterimText("");
                } else {
                    setInterimText(text);
                }
            } else if (message.text) {
                setInterimText(cleanText(message.text));
            }

            if (message.buffer_transcription !== undefined) {
                setInterimText(cleanText(message.buffer_transcription));
            }
            if (message.remaining_time_transcription !== undefined) {
                setLatencySeconds(message.remaining_time_transcription);
            }
            if (isRunningRef.current) {
                setStatus("listening");
            }
        },
        [updateLines],
    );

    const startWebSocket = useCallback(async () => {
        if (!LIVE_WS_URL) {
            throw new Error("Live transcription WebSocket is not configured.");
        }

        setStatus("connecting");

        await new Promise<void>((resolve, reject) => {
            const protocol = resolveLiveServerProtocol(LIVE_WS_URL);
            const socket = new WebSocket(
                makeWebSocketUrl(LIVE_WS_URL, baseLanguage, protocol),
            );
            const whisperLiveUid =
                protocol === "whisperlive" ? makeLiveSessionId() : null;
            websocketRef.current = socket;
            whisperLiveUidRef.current = whisperLiveUid;
            let captureStarted = false;
            let promiseSettled = false;
            const settleResolve = () => {
                if (promiseSettled) return;
                promiseSettled = true;
                resolve();
            };
            const settleReject = (reason: Error) => {
                if (promiseSettled) return;
                promiseSettled = true;
                reject(reason);
            };
            const sendPcmFrame = (frame: ArrayBuffer) => {
                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(frame);
                }
            };
            const sendWhisperLiveFrame = (samples: Float32Array) => {
                sendPcmFrame(float32SamplesToBuffer(samples));
            };
            const sendPcm16Frame = (samples: Float32Array) => {
                sendPcmFrame(floatToPcm16(samples));
            };
            const beginPcmCapture = (
                sendSamples: (samples: Float32Array) => void,
            ) => {
                if (captureStarted) return;
                captureStarted = true;
                startPcmCapture(sendSamples)
                    .then(() => {
                        setStatus("listening");
                        settleResolve();
                    })
                    .catch(settleReject);
            };
            const beginEncodedCapture = () => {
                if (captureStarted) return;
                captureStarted = true;
                startEncodedWebSocketCapture(socket)
                    .then(() => {
                        setStatus("listening");
                        settleResolve();
                    })
                    .catch(settleReject);
            };
            const timeout = window.setTimeout(() => {
                if (!captureStarted && socket.readyState === WebSocket.OPEN) {
                    beginPcmCapture(
                        protocol === "whisperlive"
                            ? sendWhisperLiveFrame
                            : sendPcm16Frame,
                    );
                }
            }, protocol === "whisperlive" ? 4000 : 2000);

            socket.binaryType = "arraybuffer";

            socket.addEventListener("open", () => {
                setStatus("connecting");
                if (protocol === "whisperlive" && whisperLiveUid) {
                    socket.send(
                        JSON.stringify(
                            makeWhisperLiveConfig(whisperLiveUid, baseLanguage),
                        ),
                    );
                }
            });

            socket.addEventListener("message", (event) => {
                if (typeof event.data !== "string") return;

                let message: WhisperLiveKitMessage;
                try {
                    message = JSON.parse(event.data);
                } catch {
                    return;
                }

                if (
                    protocol === "whisperlive" &&
                    message.message === "SERVER_READY" &&
                    !captureStarted
                ) {
                    window.clearTimeout(timeout);
                    beginPcmCapture(sendWhisperLiveFrame);
                    applyWebSocketMessage(message);
                    return;
                }

                if (message.type === "config" && !captureStarted) {
                    window.clearTimeout(timeout);
                    if (message.useAudioWorklet) {
                        beginPcmCapture(sendPcm16Frame);
                    } else {
                        beginEncodedCapture();
                    }
                    return;
                }

                applyWebSocketMessage(message);
            });

            socket.addEventListener("error", () => {
                window.clearTimeout(timeout);
                settleReject(
                    new Error("Unable to connect to live transcription server."),
                );
            });

            socket.addEventListener("close", () => {
                window.clearTimeout(timeout);
                whisperLiveUidRef.current = null;
                if (!promiseSettled && isRunningRef.current) {
                    settleReject(
                        new Error(
                            "Live transcription server closed the connection.",
                        ),
                    );
                }
                if (isRunningRef.current) {
                    setStatus("idle");
                    isRunningRef.current = false;
                }
            });
        });
    }, [
        applyWebSocketMessage,
        baseLanguage,
        startEncodedWebSocketCapture,
        startPcmCapture,
    ]);

    const startLocal = useCallback(async () => {
        setStatus("connecting");
        await startPcmCapture();
        setStatus("listening");
    }, [startPcmCapture]);

    const start = useCallback(async () => {
        if (!isSupported || isRunningRef.current) return;

        sessionIdRef.current++;
        isRunningRef.current = true;
        transcriptStartRef.current = performance.now() / 1000;
        audioBufferRef.current = { chunks: [], totalSamples: 0 };
        lastEnqueuedSampleRef.current = 0;
        localQueueRef.current = [];
        activeSegmentRef.current = null;
        localBusyRef.current = false;
        setElapsedSeconds(0);
        setLatencySeconds(undefined);
        setInputLevel(0);
        setQueueDepth(0);
        setError(undefined);
        setWarning(undefined);
        setInterimText("");

        stopElapsedTimer();
        elapsedTimerRef.current = window.setInterval(() => {
            setElapsedSeconds(
                Math.max(0, performance.now() / 1000 - transcriptStartRef.current),
            );
        }, 500);

        try {
            if (engine === "websocket" && LIVE_WS_URL) {
                await startWebSocket();
            } else {
                await startLocal();
            }
        } catch (startError) {
            cleanupAudio();
            cleanupWebSocket();
            stopElapsedTimer();
            isRunningRef.current = false;
            setStatus("error");
            setError(
                startError instanceof Error
                    ? startError.message
                    : "Unable to start live transcription.",
            );
        }
    }, [
        cleanupAudio,
        cleanupWebSocket,
        engine,
        isSupported,
        startLocal,
        startWebSocket,
        stopElapsedTimer,
    ]);

    useEffect(() => {
        return () => {
            isRunningRef.current = false;
            cleanupAudio();
            cleanupWebSocket();
            stopElapsedTimer();
        };
    }, [cleanupAudio, cleanupWebSocket, stopElapsedTimer]);

    const captionText = useMemo(() => {
        const recentFinal = lines
            .slice(-2)
            .map((line) => line.text)
            .join(" ");
        return cleanText([recentFinal, interimText].filter(Boolean).join(" "));
    }, [interimText, lines]);

    return {
        availableEngines,
        engine,
        setEngine,
        status,
        isRunning,
        isSupported,
        isModelLoading,
        progressItems,
        error,
        warning,
        lines,
        interimText,
        captionText,
        elapsedSeconds,
        latencySeconds,
        inputLevel,
        queueDepth,
        model,
        language: baseLanguage,
        start,
        stop,
        reset,
    };
}
