/// <reference types="vite/client" />
/// <reference types="unplugin-icons/types/react" />

interface ImportMetaEnv {
    readonly VITE_SHOW_CREDITS?: string;
    readonly VITE_HF_AUTH_TOKEN?: string;
    readonly VITE_HF_TOKEN?: string;
    readonly VITE_DEBUG_TRANSCRIPTION?: string;
    readonly VITE_LIVE_TRANSCRIPTION_WS_URL?: string;
    readonly VITE_LIVE_TRANSCRIPTION_SERVER?: string;
    readonly VITE_LIVE_TRANSCRIPTION_MODEL?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

interface WhisperWebRuntimeConfig {
    readonly liveTranscriptionWsUrl?: string;
    readonly liveTranscriptionServer?: string;
    readonly liveTranscriptionModel?: string;
}

interface Window {
    readonly __WHISPER_WEB_CONFIG__?: WhisperWebRuntimeConfig;
}
