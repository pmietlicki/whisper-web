import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from "react";

import { formatAudioTimestamp } from "../utils/AudioUtils";
import { webmFixDuration } from "../utils/BlobFix";
import { t } from "i18next";

function getMimeType() {
    const types = [
        "audio/webm",
        "audio/mp4",
        "audio/ogg",
        "audio/wav",
        "audio/aac",
    ];
    for (let i = 0; i < types.length; i++) {
        if (MediaRecorder.isTypeSupported(types[i])) {
            return types[i];
        }
    }
    return undefined;
}

export interface AudioRecorderHandle {
    stopAndGetRecording: () => Promise<Blob | undefined>;
}

interface AudioRecorderProps {
    onRecordingProgress: (blob: Blob) => void;
    onRecordingComplete: (blob: Blob) => void;
    onRecordingStateChange?: (recording: boolean) => void;
}

const AudioRecorder = forwardRef<AudioRecorderHandle, AudioRecorderProps>(
function AudioRecorder(
    { onRecordingProgress, onRecordingComplete, onRecordingStateChange },
    ref,
) {
    const [recording, setRecording] = useState(false);
    const [duration, setDuration] = useState(0);
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
    const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
    const [recordingError, setRecordingError] = useState<string | null>(null);

    const streamRef = useRef<MediaStream | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const mimeTypeRef = useRef<string | undefined>(undefined);
    const startTimeRef = useRef(0);
    const stopPromiseRef = useRef<Promise<Blob | undefined> | null>(null);
    const stopResolveRef = useRef<((blob: Blob | undefined) => void) | null>(
        null,
    );

    const audioRef = useRef<HTMLAudioElement | null>(null);

    const resolveStopPromise = useCallback((blob: Blob | undefined) => {
        stopResolveRef.current?.(blob);
        stopResolveRef.current = null;
        stopPromiseRef.current = null;
    }, []);

    const completeRecording = useCallback(
        async () => {
            const mimeType = mimeTypeRef.current;
            const recordedChunks = chunksRef.current;
            chunksRef.current = [];
            mediaRecorderRef.current = null;
            setDuration(0);
            setRecording(false);
            onRecordingStateChange?.(false);

            if (recordedChunks.length === 0) {
                resolveStopPromise(undefined);
                return;
            }

            const duration = Date.now() - startTimeRef.current;
            let blob = new Blob(recordedChunks, { type: mimeType });

            if (mimeType === "audio/webm") {
                try {
                    blob = await webmFixDuration(blob, duration, blob.type);
                } catch (error) {
                    console.error("Error fixing recording duration:", error);
                }
            }

            setRecordedBlob(blob);
            setRecordedUrl((previousUrl) => {
                if (previousUrl) {
                    URL.revokeObjectURL(previousUrl);
                }
                return URL.createObjectURL(blob);
            });
            onRecordingComplete(blob);
            resolveStopPromise(blob);
        },
        [onRecordingComplete, onRecordingStateChange, resolveStopPromise],
    );

    const startRecording = async () => {
        // Reset recording (if any)
        setRecordedBlob(null);
        setRecordedUrl((previousUrl) => {
            if (previousUrl) {
                URL.revokeObjectURL(previousUrl);
            }
            return null;
        });
        setRecordingError(null);
        setDuration(0);
        chunksRef.current = [];

        try {
            if (!streamRef.current) {
                streamRef.current = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                });
            }

            startTimeRef.current = Date.now();

            const mimeType = getMimeType();
            mimeTypeRef.current = mimeType;
            const mediaRecorder = new MediaRecorder(streamRef.current, {
                mimeType,
            });

            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.addEventListener("dataavailable", async (event) => {
                if (event.data.size === 0) {
                    // Ignore empty data
                    return;
                }
                chunksRef.current.push(event.data);

                if (mediaRecorder.state === "recording") {
                    onRecordingProgress(
                        new Blob(chunksRef.current, { type: mimeType }),
                    );
                }
            });
            mediaRecorder.addEventListener("stop", () => {
                void completeRecording();
            });
            mediaRecorder.start();
            setRecording(true);
            onRecordingStateChange?.(true);
        } catch (error) {
            console.error("Error accessing microphone:", error);
            setRecordingError(t("recorder.recording_error"));
            setRecording(false);
            onRecordingStateChange?.(false);
        }
    };

    const stopRecording = useCallback(() => {
        const mediaRecorder = mediaRecorderRef.current;
        if (stopPromiseRef.current) {
            return stopPromiseRef.current;
        }

        if (!mediaRecorder || mediaRecorder.state === "inactive") {
            return Promise.resolve(recordedBlob ?? undefined);
        }

        stopPromiseRef.current = new Promise<Blob | undefined>((resolve) => {
            stopResolveRef.current = resolve;
        });

        try {
            mediaRecorder.stop();
            setDuration(0);
            setRecording(false);
            onRecordingStateChange?.(false);
        } catch (error) {
            console.error("Error stopping recording:", error);
            resolveStopPromise(recordedBlob ?? undefined);
        }

        return stopPromiseRef.current;
    }, [onRecordingStateChange, recordedBlob, resolveStopPromise]);

    useImperativeHandle(
        ref,
        () => ({
            stopAndGetRecording: stopRecording,
        }),
        [stopRecording],
    );

    useEffect(() => {
        if (recording) {
            const timer = setInterval(() => {
                setDuration((prevDuration) => prevDuration + 1);
            }, 1000);

            return () => {
                clearInterval(timer);
            };
        }
    }, [recording]);

    useEffect(() => {
        return () => {
            if (recordedUrl) {
                URL.revokeObjectURL(recordedUrl);
            }
        };
    }, [recordedUrl]);

    useEffect(() => {
        return () => {
            if (mediaRecorderRef.current?.state === "recording") {
                mediaRecorderRef.current.stop();
            }
            streamRef.current?.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        };
    }, []);

    const handleToggleRecording = () => {
        if (recording) {
            void stopRecording();
        } else {
            void startRecording();
        }
    };

    return (
        <div className='flex flex-col justify-center items-center'>
            <button
                type='button'
                className={`m-2 inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 transition-all duration-200 ${
                    recording
                        ? "bg-red-500 hover:bg-red-600"
                        : "bg-green-500 hover:bg-green-600"
                }`}
                onClick={handleToggleRecording}
                aria-pressed={recording}
            >
                {recording
                    ? t("recorder.stop_recording", {
                          duration: formatAudioTimestamp(duration),
                      })
                    : t("recorder.start_recording")}
            </button>

            {recordingError && (
                <p className='mt-2 text-sm text-red-700' role='alert'>
                    {recordingError}
                </p>
            )}

            {recordedBlob && recordedUrl && (
                <audio
                    className='w-full'
                    ref={audioRef}
                    controls
                    aria-label={t("recorder.recording_preview")}
                >
                    <source
                        src={recordedUrl}
                        type={recordedBlob.type}
                    />
                </audio>
            )}
        </div>
    );
});

export default AudioRecorder;
