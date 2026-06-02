/// <reference types="vite/client" />
/// <reference types="unplugin-icons/types/react" />

interface ImportMetaEnv {
    readonly VITE_SHOW_CREDITS?: string;
    readonly VITE_HF_AUTH_TOKEN?: string;
    readonly VITE_HF_TOKEN?: string;
    readonly VITE_DEBUG_TRANSCRIPTION?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
