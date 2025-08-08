import { useRef, useEffect, useState, useMemo, memo } from "react";
import { FixedSizeList as List } from 'react-window';
import { t } from "i18next"; // Assurez-vous que i18next est configuré

// SECTION 1: DÉFINITIONS DES TYPES
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
    tps?: number;
}
/*interface SpeakerGroup {
    speaker: string;
    chunks: Chunk[];
    startTime: number;
    endTime: number;
}*/

// SECTION 2: FONCTIONS UTILITAIRES
function formatAudioTimestamp(timeInSeconds: number): string {
    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    const pad = (num: number) => num.toString().padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
function formatSrtTimeRange(start: number, end: number | null): string {
    const format = (time: number): string => {
        const hours = Math.floor(time / 3600);
        const minutes = Math.floor((time % 3600) / 60);
        const seconds = Math.floor(time % 60);
        const milliseconds = Math.round((time - Math.floor(time)) * 1000);
        const pad = (num: number, length = 2) => num.toString().padStart(length, '0');
        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(milliseconds, 3)}`;
    };
    return `${format(start)} --> ${format(end ?? start)}`;
}
const SPEAKER_COLORS = [
    { bg: 'bg-blue-500', text: 'text-blue-800', border: 'border-blue-500' },
    { bg: 'bg-green-500', text: 'text-green-800', border: 'border-green-500' },
    { bg: 'bg-purple-500', text: 'text-purple-800', border: 'border-purple-500' },
    { bg: 'bg-orange-500', text: 'text-orange-800', border: 'border-orange-500' },
    { bg: 'bg-red-500', text: 'text-red-800', border: 'border-red-500' },
    { bg: 'bg-teal-500', text: 'text-teal-800', border: 'border-teal-500' },
    { bg: 'bg-pink-500', text: 'text-pink-800', border: 'border-pink-500' },
];
const DEFAULT_COLOR = { bg: 'bg-gray-500', text: 'text-gray-800', border: 'border-gray-500' };
function getSpeakerColor(speakerLabel?: string) {
    if (!speakerLabel) return DEFAULT_COLOR;
    let hash = 0;
    for (let i = 0; i < speakerLabel.length; i++) {
        hash = speakerLabel.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash % SPEAKER_COLORS.length);
    return SPEAKER_COLORS[index];
}

// SECTION 3: SOUS-COMPOSANT
interface TranscriptChunkProps {
    chunk: Chunk;
    isCurrent: boolean;
    isBusy: boolean;
    showSpeaker: boolean;
    onClick: () => void;
    style?: React.CSSProperties;
}
const TranscriptChunk = memo(({ chunk, isCurrent, isBusy, showSpeaker, onClick, style }: TranscriptChunkProps) => {
    const color = getSpeakerColor(chunk.speaker);
    const chunkClasses = `w-full h-full flex flex-row p-3 rounded-lg cursor-pointer transition-all duration-200 shadow-sm border ${
        isCurrent
            ? `bg-yellow-100 border-l-4 ${color.border} shadow-md`
            : isBusy
            ? 'bg-gray-100 hover:bg-gray-200 border-gray-100'
            : 'bg-gray-50 hover:bg-blue-50 border-gray-100'
    }`;
    return (
        <div style={style} className="px-2 py-1" onClick={onClick}>
            <div className={chunkClasses}>
                <div className='mr-4 text-xs text-gray-500 font-mono min-w-[60px] mt-1'>
                    {formatAudioTimestamp(chunk.timestamp[0])}
                </div>
                <div className='flex-1'>
                    {showSpeaker && chunk.speaker && (
                        <div className='flex items-center mb-1'>
                            <div className={`w-2 h-2 rounded-full mr-2 ${color.bg}`}></div>
                            <span className={`text-xs font-medium ${color.text}`}>{chunk.speaker}</span>
                        </div>
                    )}
                    <div className={`text-gray-800 leading-relaxed ${isCurrent ? 'font-medium' : ''}`}>
                        {chunk.text}
                    </div>
                </div>
                {chunk.confidence && (
                    <div className='ml-2 text-xs text-gray-400 self-start mt-1'>
                        {Math.round(chunk.confidence * 100)}%
                    </div>
                )}
            </div>
        </div>
    );
});

// SECTION 4: COMPOSANT PRINCIPAL
interface TranscriptProps {
    transcribedData: TranscriberData | undefined;
    interimTranscript: string | undefined;
    currentTime?: number;
    onSeek?: (time: number) => void;
}
export default function Transcript({ transcribedData, interimTranscript, currentTime, onSeek }: TranscriptProps) {
    // Mode fixé sur 'chunks' car la diarisation est désactivée
    //const viewMode = 'chunks';
    const [autoScroll, setAutoScroll] = useState(true);

    const endOfMessagesRef = useRef<HTMLDivElement>(null);
    const virtualListRef = useRef<List>(null);
    //const speakerViewRef = useRef<HTMLDivElement>(null);

    /*const speakerGroups = useMemo((): SpeakerGroup[] => {
        if (!transcribedData?.chunks || !transcribedData?.speakerSegments) return [];
        const groups: SpeakerGroup[] = [];
        let chunkIndex = 0;
        for (const segment of transcribedData.speakerSegments) {
            if (segment.label === 'NO_SPEAKER') continue;
            const segmentChunks: Chunk[] = [];
            while (chunkIndex < transcribedData.chunks.length) {
                const chunk = transcribedData.chunks[chunkIndex];
                const chunkEndTime = chunk.timestamp[1] ?? chunk.timestamp[0];
                if (chunkEndTime <= segment.end) {
                    segmentChunks.push(chunk);
                    chunkIndex++;
                } else {
                    break;
                }
            }
            if (segmentChunks.length > 0) {
                groups.push({
                    speaker: segment.label,
                    chunks: segmentChunks,
                    startTime: segment.start,
                    endTime: segment.end
                });
            }
        }
        return groups;
    }, [transcribedData?.chunks, transcribedData?.speakerSegments]);*/

    const currentChunkIndex = useMemo(() => {
        if (!transcribedData?.chunks || currentTime === undefined) return -1;
        return transcribedData.chunks.findIndex(chunk => {
            const start = chunk.timestamp[0];
            const end = chunk.timestamp[1] ?? start;
            return currentTime >= start && currentTime < end;
        });
    }, [transcribedData?.chunks, currentTime]);

    useEffect(() => {
        if (!autoScroll) return;
        if (currentChunkIndex >= 0 && virtualListRef.current) {
            virtualListRef.current.scrollToItem(currentChunkIndex, 'center');
        }
        if (transcribedData?.isBusy || interimTranscript) {
            endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [currentChunkIndex, autoScroll, transcribedData?.isBusy, interimTranscript]);

    const saveBlob = (blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const exportTXT = () => {
        const text = transcribedData?.chunks.map(c => c.text).join(" ").trim() ?? "";
        saveBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), "transcript.txt");
    };

    const exportJSON = () => {
        const jsonData = JSON.stringify(transcribedData, null, 2);
        saveBlob(new Blob([jsonData], { type: "application/json;charset=utf-8" }), "transcript.json");
    };

    const exportSRT = () => {
        const srt = (transcribedData?.chunks ?? []).map((chunk, i) => {
            const speakerPrefix = chunk.speaker ? `${chunk.speaker}: ` : "";
            const timeRange = formatSrtTimeRange(chunk.timestamp[0], chunk.timestamp[1]);
            return `${i + 1}\n${timeRange}\n${speakerPrefix}${chunk.text.trim()}`;
        }).join("\n\n");
        saveBlob(new Blob([srt], { type: "application/srt;charset=utf-8" }), "transcript.srt");
    };

    // *** VARIABLE MANQUANTE AJOUTÉE ICI ***
    const exportButtons = [
        { name: "TXT", onClick: exportTXT },
        { name: "JSON", onClick: exportJSON },
        { name: "SRT", onClick: exportSRT },
    ];

    return (
        <div className='w-full flex flex-col'>
            {/* --- EMPLACEMENT 1: CONTRÔLES --- */}
            {transcribedData?.chunks && transcribedData.chunks.length > 0 && (
                <div className='flex flex-wrap items-center justify-between gap-4 mb-4 p-3 bg-gray-50 rounded-lg border'>
                    <div className='flex items-center space-x-4'>
                        <label className='flex items-center space-x-2 cursor-pointer'>
                            <input type='checkbox' checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} className='w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500' />
                            <span className='text-sm text-gray-700'>{t("transcript.auto_scroll", "Défilement auto")}</span>
                        </label>
                    </div>
                </div>
            )}

            {/* --- CONTENEUR DE LA TRANSCRIPTION --- */}
            {(transcribedData?.chunks && transcribedData.chunks.length > 0) || interimTranscript ? (
                <div className='w-full border border-gray-200 rounded-lg bg-white overflow-hidden'>
                    {transcribedData?.chunks && transcribedData.chunks.length > 0 && (
                        <List ref={virtualListRef} height={interimTranscript ? 550 : 600} itemCount={transcribedData.chunks.length} itemSize={90} width="100%">
                            {({ index, style }) => (
                                <TranscriptChunk style={style} chunk={transcribedData.chunks[index]} isCurrent={index === currentChunkIndex} isBusy={transcribedData.isBusy} showSpeaker={false} onClick={() => onSeek?.(transcribedData.chunks[index].timestamp[0])} />
                            )}
                        </List>
                    )}
                    {interimTranscript && (
                        <div className="w-full px-2 py-1 border-t border-gray-200">
                            <div className="w-full flex flex-row p-3 rounded-lg bg-blue-50 border border-blue-200 animate-pulse">
                                <div className='mr-4 text-xs text-blue-500 font-mono min-w-[60px] mt-1'>{t('transcript.transcribing_in_progress')}</div>
                                <div className='flex-1 text-blue-700 italic'>
                                    <span className='text-xs text-blue-500 mr-2'>{t('transcript.real_time_transcription')}</span>
                                    {interimTranscript}
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={endOfMessagesRef} />
                </div>
            ) : null}

            {/* --- EMPLACEMENT 2: BOUTONS D'EXPORT ET STATISTIQUES --- */}
            <div className="mt-4">
                {transcribedData && !transcribedData.isBusy && transcribedData.chunks.length > 0 && (
                    <div className='w-full text-center mt-6 border-t pt-6'>
                        <span className="text-sm font-medium text-gray-800 mr-3">{t("transcript.export_as", "Exporter en")}:</span>
                        <div className="inline-flex rounded-md shadow-sm" role="group">
                            {exportButtons.map((button) => (
                                <button key={button.name} onClick={button.onClick} className="px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-200 first:rounded-l-lg last:rounded-r-lg hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-2 focus:ring-blue-700 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:hover:text-white dark:hover:bg-gray-600 dark:focus:ring-blue-500 dark:focus:text-white">
                                    {button.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {transcribedData && !transcribedData.isBusy && transcribedData.tps && (
                    <div className='flex flex-wrap justify-center items-center mt-6 space-x-4 md:space-x-8 text-sm text-gray-600'>
                        <div className='text-center'><span className='font-semibold text-black'>{transcribedData.tps.toFixed(2)}</span><span className='ml-1'>{t("transcript.tokens_per_second", "tokens/sec")}</span></div>
                        {transcribedData.chunks && (<div className='text-center'><span className='font-semibold text-black'>{transcribedData.chunks.length}</span><span className='ml-1'>{t("transcript.total_chunks", "segments")}</span></div>)}
                        {transcribedData.speakerSegments && transcribedData.speakerSegments.length > 0 && (<div className='text-center'><span className='font-semibold text-black'>{transcribedData.speakerSegments.length}</span><span className='ml-1'>{t("transcript.speaker_turns", "tours de parole")}</span></div>)}
                    </div>
                )}
            </div>
        </div>
    );
}