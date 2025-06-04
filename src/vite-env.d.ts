/// <reference types="vite/client" />
/// <reference types="unplugin-icons/types/react" />

interface ImportMetaEnv {
    readonly VITE_SHOW_CREDITS?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}