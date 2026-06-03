import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { LiveEngine } from "../hooks/useLiveTranscription";
import { useLiveTranscription } from "../hooks/useLiveTranscription";
import { MODELS } from "../utils/Constants";

interface LiveTranscriptionPanelProps {
    language: string;
    onEngineChange?: (engine: LiveEngine) => void;
}

function formatDuration(seconds: number) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function formatSrtTimestamp(seconds: number) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const wholeSeconds = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);

    return `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:${wholeSeconds
        .toString()
        .padStart(2, "0")},${milliseconds.toString().padStart(3, "0")}`;
}

function saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function MicIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
        >
            <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <path d="M12 19v3" />
        </svg>
    );
}

function StopIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
        >
            <rect x="6" y="6" width="12" height="12" rx="1" />
        </svg>
    );
}

function TrashIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
        >
            <path d="M4 7h16" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
            <path d="m5 7 1 14h12l1-14" />
            <path d="M9 7V4h6v3" />
        </svg>
    );
}

function DownloadIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
        >
            <path d="M12 3v12" />
            <path d="m7 10 5 5 5-5" />
            <path d="M5 21h14" />
        </svg>
    );
}

export default function LiveTranscriptionPanel({
    language,
    onEngineChange,
}: LiveTranscriptionPanelProps) {
    const { t } = useTranslation();
    const live = useLiveTranscription({ language });

    const modelLabel = MODELS[live.model]?.[0] ?? live.model;
    const languageLabel = t(`language_selector.${live.language}`, {
        defaultValue: live.language.toUpperCase(),
    });
    const isBusy =
        live.status === "connecting" ||
        live.status === "processing" ||
        live.isModelLoading;
    const canExport = live.lines.length > 0;

    useEffect(() => {
        onEngineChange?.(live.engine);
    }, [live.engine, onEngineChange]);

    const statusLabel = useMemo(() => {
        if (!live.isSupported) return t("live.unsupported");
        return t(`live.status_${live.status}`);
    }, [live.isSupported, live.status, t]);

    const exportTxt = () => {
        const text = live.lines.map((line) => line.text).join("\n");
        saveBlob(
            new Blob([text], { type: "text/plain;charset=utf-8" }),
            "live-transcript.txt",
        );
    };

    const exportSrt = () => {
        const srt = live.lines
            .map((line, index) => {
                const end = Math.max(line.end, line.start + 0.8);
                return `${index + 1}\n${formatSrtTimestamp(
                    line.start,
                )} --> ${formatSrtTimestamp(end)}\n${line.text}`;
            })
            .join("\n\n");
        saveBlob(
            new Blob([srt], { type: "application/srt;charset=utf-8" }),
            "live-transcript.srt",
        );
    };

    return (
        <section
            id="live-transcription-panel"
            className="my-6 w-full max-w-5xl px-3 sm:px-4"
            aria-label={t("live.region_label")}
        >
            <div className="w-full border border-slate-200 bg-white shadow-xl shadow-black/5">
                <div className="flex flex-col gap-3 border-b border-slate-200 p-3 sm:p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">
                                {languageLabel}
                            </span>
                            <span className="rounded-full bg-slate-50 px-3 py-1 text-sm font-medium text-slate-700 ring-1 ring-slate-200">
                                {modelLabel}
                            </span>
                            <span
                                className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${
                                    live.status === "error"
                                        ? "bg-red-50 text-red-800 ring-red-200"
                                        : live.isRunning
                                          ? "bg-blue-50 text-blue-800 ring-blue-200"
                                          : "bg-slate-50 text-slate-700 ring-slate-200"
                                }`}
                            >
                                {statusLabel}
                            </span>
                        </div>

                        {live.availableEngines.length > 1 && (
                            <div
                                className="inline-flex w-full rounded-md border border-slate-200 bg-slate-50 p-1 sm:w-auto"
                                role="group"
                                aria-label={t("live.engine_group")}
                            >
                                {live.availableEngines.map((engine) => (
                                    <button
                                        key={engine}
                                        type="button"
                                        onClick={() => live.setEngine(engine)}
                                        disabled={live.isRunning}
                                        className={`flex-1 rounded px-3 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 sm:flex-none ${
                                            live.engine === engine
                                                ? "bg-white text-slate-950 shadow-sm"
                                                : "text-slate-600 hover:text-slate-950"
                                        } disabled:cursor-not-allowed disabled:opacity-60`}
                                    >
                                        {t(`live.engine_${engine}`)}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="grid grid-cols-3 gap-2 text-center text-xs text-slate-600 sm:flex sm:text-left">
                            <div>
                                <span className="block font-semibold text-slate-950">
                                    {formatDuration(live.elapsedSeconds)}
                                </span>
                                <span>{t("live.elapsed")}</span>
                            </div>
                            <div>
                                <span className="block font-semibold text-slate-950">
                                    {live.latencySeconds !== undefined
                                        ? `${live.latencySeconds.toFixed(1)}s`
                                        : "-"}
                                </span>
                                <span>{t("live.latency")}</span>
                            </div>
                            <div>
                                <span className="block font-semibold text-slate-950">
                                    {live.queueDepth}
                                </span>
                                <span>{t("live.queue")}</span>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => void live.start()}
                                disabled={!live.isSupported || live.isRunning}
                                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300"
                                aria-busy={isBusy}
                            >
                                <MicIcon />
                                {t("live.start")}
                            </button>
                            <button
                                type="button"
                                onClick={live.stop}
                                disabled={!live.isRunning}
                                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                                <StopIcon />
                                {t("live.stop")}
                            </button>
                            <button
                                type="button"
                                onClick={live.reset}
                                disabled={live.isRunning || !canExport}
                                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                aria-label={t("live.clear")}
                            >
                                <TrashIcon />
                            </button>
                            <div
                                className="inline-flex rounded-md shadow-sm"
                                role="group"
                                aria-label={t("live.export_group")}
                            >
                                <button
                                    type="button"
                                    onClick={exportTxt}
                                    disabled={!canExport}
                                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-l-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus:z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <DownloadIcon />
                                    TXT
                                </button>
                                <button
                                    type="button"
                                    onClick={exportSrt}
                                    disabled={!canExport}
                                    className="min-h-11 rounded-r-md border border-l-0 border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus:z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    SRT
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                            className="h-full rounded-full bg-emerald-500 transition-[width] duration-100"
                            style={{
                                width: `${Math.min(100, live.inputLevel * 900)}%`,
                            }}
                            aria-hidden="true"
                        />
                    </div>
                </div>

                {live.progressItems.length > 0 && (
                    <div
                        className="border-b border-slate-200 px-4 py-3 text-sm text-slate-700"
                        role="status"
                        aria-live="polite"
                    >
                        <div className="mb-2 font-medium">
                            {t("manager.loading")}
                        </div>
                        <div className="space-y-2">
                            {live.progressItems.map((item, index) => (
                                <div key={`${item.file}-${index}`}>
                                    <div className="mb-1 truncate">
                                        {item.file}
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                        <div
                                            className="h-full rounded-full bg-blue-600"
                                            style={{
                                                width: `${Math.round(
                                                    item.progress ?? 0,
                                                )}%`,
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {(live.error || live.warning) && (
                    <div
                        className={`border-b px-4 py-3 text-sm ${
                            live.error
                                ? "border-red-200 bg-red-50 text-red-800"
                                : "border-amber-200 bg-amber-50 text-amber-900"
                        }`}
                        role={live.error ? "alert" : "status"}
                    >
                        {live.error ??
                            (live.warning?.startsWith("live.")
                                ? t(live.warning)
                                : live.warning)}
                    </div>
                )}

                <div
                    className="min-h-[220px] bg-neutral-950 px-4 py-5 text-white sm:min-h-[280px] sm:px-6 sm:py-8"
                    aria-live="polite"
                    aria-atomic="false"
                >
                    <div className="mx-auto flex min-h-[180px] max-w-4xl items-center justify-center text-center sm:min-h-[220px]">
                        {live.captionText ? (
                            <p className="text-balance text-2xl font-semibold leading-snug sm:text-3xl md:text-4xl">
                                {live.captionText}
                            </p>
                        ) : (
                            <p className="text-lg font-medium text-slate-300 sm:text-xl">
                                {live.isRunning
                                    ? t("live.waiting_for_speech")
                                    : t("live.empty")}
                            </p>
                        )}
                    </div>
                </div>

                {live.lines.length > 0 && (
                    <div className="max-h-72 overflow-y-auto border-t border-slate-200 bg-white p-3">
                        <ol className="space-y-2" aria-label={t("live.history")}>
                            {live.lines.slice(-12).map((line) => (
                                <li
                                    key={line.id}
                                    className="grid grid-cols-[4.5rem_1fr] gap-3 rounded-md bg-slate-50 px-3 py-2 text-sm"
                                >
                                    <span className="font-mono text-xs text-slate-500">
                                        {formatDuration(line.start)}
                                    </span>
                                    <span className="text-slate-900">
                                        {line.text}
                                    </span>
                                </li>
                            ))}
                        </ol>
                    </div>
                )}
            </div>
        </section>
    );
}
