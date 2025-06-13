import React, { useRef, useEffect, useState, useMemo } from "react";
import { TranscriberData } from "../hooks/useTranscriber";
import { formatAudioTimestamp, formatSrtTimeRange } from "../utils/AudioUtils";
import { t } from "i18next";

interface Props {
    transcribedData: TranscriberData | undefined;
    currentTime?: number;
    onSeek?: (time: number) => void;
}

interface SpeakerGroup {
    speaker: string;
    chunks: Array<{
        text: string;
        timestamp: [number, number | null];
        speaker?: string;
        confidence?: number;
    }>;
    startTime: number;
    endTime: number;
}

export default function Transcript({ transcribedData, currentTime, onSeek }: Props) {
    const divRef = useRef<HTMLDivElement>(null);
    const endOfMessagesRef = useRef<HTMLDivElement>(null);
    const [viewMode, setViewMode] = useState<'chunks' | 'speakers'>('speakers');
    const [autoScroll, setAutoScroll] = useState(true);

    // Group chunks by speaker
    const speakerGroups = useMemo((): SpeakerGroup[] => {
        if (!transcribedData?.chunks) return [];
        
        const groups: SpeakerGroup[] = [];
        let currentGroup: SpeakerGroup | null = null;
        
        for (const chunk of transcribedData.chunks) {
            const speaker = chunk.speaker || 'Unknown Speaker';
            
            if (!currentGroup || currentGroup.speaker !== speaker) {
                if (currentGroup) {
                    groups.push(currentGroup);
                }
                currentGroup = {
                    speaker,
                    chunks: [chunk],
                    startTime: chunk.timestamp[0] || 0,
                    endTime: chunk.timestamp[1] || chunk.timestamp[0] || 0
                };
            } else {
                currentGroup.chunks.push(chunk);
                currentGroup.endTime = chunk.timestamp[1] || chunk.timestamp[0] || currentGroup.endTime;
            }
        }
        
        if (currentGroup) {
            groups.push(currentGroup);
        }
        
        return groups;
    }, [transcribedData?.chunks]);

    // Find current speaking chunk
    const currentChunkIndex = useMemo(() => {
        if (!transcribedData?.chunks || currentTime === undefined) return -1;
        
        return transcribedData.chunks.findIndex(chunk => {
            const start = chunk.timestamp[0] || 0;
            const end = chunk.timestamp[1] || start;
            return currentTime >= start && currentTime <= end;
        });
    }, [transcribedData?.chunks, currentTime]);

    // Auto-scroll to current chunk
    useEffect(() => {
        if (autoScroll && currentChunkIndex >= 0) {
            const currentElement = document.querySelector(`[data-chunk-index="${currentChunkIndex}"]`);
            if (currentElement) {
                currentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [currentChunkIndex, autoScroll]);

    // Scroll to bottom when new chunks arrive
    useEffect(() => {
        if (autoScroll && transcribedData?.isBusy) {
            endOfMessagesRef.current?.scrollIntoView({ behavior: "auto" });
        }
    }, [transcribedData?.chunks, autoScroll]);

    const saveBlob = (blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    };

    const exportTXT = () => {
        const chunks = transcribedData?.chunks ?? [];
        let text = "";
        
        if (viewMode === 'speakers' && speakerGroups.length > 0) {
            for (const group of speakerGroups) {
                text += `${group.speaker}:\n`;
                text += group.chunks.map(chunk => chunk.text).join("").trim() + "\n\n";
            }
        } else {
            text = chunks.map((chunk) => chunk.text).join("").trim();
        }

        const blob = new Blob([text], { type: "text/plain" });
        saveBlob(blob, "transcript.txt");
    };

    const exportJSON = () => {
        const exportData = {
            chunks: transcribedData?.chunks ?? [],
            speakerSegments: transcribedData?.speakerSegments ?? [],
            metadata: {
                exportDate: new Date().toISOString(),
                totalDuration: transcribedData?.chunks?.length ? 
                    Math.max(...transcribedData.chunks.map(c => c.timestamp[1] || c.timestamp[0] || 0)) : 0
            }
        };
        
        let jsonData = JSON.stringify(exportData, null, 2);
        const regex = /(\s{4}"timestamp": )\[\s+(\S+)\s+(\S+)\s+\]/gm;
        jsonData = jsonData.replace(regex, "$1[$2 $3]");

        const blob = new Blob([jsonData], { type: "application/json" });
        saveBlob(blob, "transcript.json");
    };

    const exportSRT = () => {
        const chunks = transcribedData?.chunks ?? [];
        let srt = "";
        
        for (let i = 0; i < chunks.length; i++) {
            srt += `${i + 1}\n`;
            srt += `${formatSrtTimeRange(chunks[i].timestamp[0], chunks[i].timestamp[1] ?? chunks[i].timestamp[0])}\n`;
            
            const text = chunks[i].speaker ? 
                `${chunks[i].speaker}: ${chunks[i].text}` : 
                chunks[i].text;
            srt += `${text}\n\n`;
        }
        
        const blob = new Blob([srt], { type: "text/plain" });
        saveBlob(blob, "transcript.srt");
    };

    const handleChunkClick = (timestamp: number) => {
        if (onSeek) {
            onSeek(timestamp);
        }
    };

    const exportButtons = [
        { name: "TXT", onClick: exportTXT },
        { name: "JSON", onClick: exportJSON },
        { name: "SRT", onClick: exportSRT },
    ];

    return (
        <div className='w-full flex flex-col mt-2'>
            {/* Controls */}
            {transcribedData?.chunks && transcribedData.chunks.length > 0 && (
                <div className='flex flex-wrap items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg border'>
                    <div className='flex items-center space-x-4'>
                        {/* View Mode Toggle */}
                        <div className='flex items-center space-x-2'>
                            <span className='text-sm font-medium text-gray-700'>{t("transcript.view_mode")}:</span>
                            <button
                                onClick={() => setViewMode('chunks')}
                                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                                    viewMode === 'chunks'
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                            >
                                {t("transcript.chunks_view")}
                            </button>
                            <button
                                onClick={() => setViewMode('speakers')}
                                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                                    viewMode === 'speakers'
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                            >
                                {t("transcript.speakers_view")}
                            </button>
                        </div>
                        
                        {/* Auto-scroll Toggle */}
                        <label className='flex items-center space-x-2 cursor-pointer'>
                            <input
                                type='checkbox'
                                checked={autoScroll}
                                onChange={(e) => setAutoScroll(e.target.checked)}
                                className='w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500'
                            />
                            <span className='text-sm text-gray-700'>{t("transcript.auto_scroll")}</span>
                        </label>
                    </div>
                    
                    {/* Speaker Count */}
                    {viewMode === 'speakers' && speakerGroups.length > 0 && (
                        <div className='text-sm text-gray-600'>
                            {t("transcript.speakers_detected", { count: speakerGroups.length })}
                        </div>
                    )}
                </div>
            )}
            
            {/* Transcript Content */}
            {transcribedData?.chunks && transcribedData.chunks.length > 0 && (
                <div
                    ref={divRef}
                    className='w-full max-h-[400px] overflow-y-auto scrollbar-thin border border-gray-200 rounded-lg p-4 bg-white'
                >
                    {viewMode === 'speakers' ? (
                        /* Speaker-grouped view */
                        speakerGroups.map((group, groupIndex) => (
                            <div key={`group-${groupIndex}`} className='mb-6 last:mb-0'>
                                <div className='flex items-center mb-3'>
                                    <div className={`w-3 h-3 rounded-full mr-3 ${
                                        group.speaker === 'Speaker 1' ? 'bg-blue-500' :
                                        group.speaker === 'Speaker 2' ? 'bg-green-500' :
                                        group.speaker === 'Speaker 3' ? 'bg-purple-500' :
                                        group.speaker === 'Speaker 4' ? 'bg-orange-500' :
                                        'bg-gray-500'
                                    }`}></div>
                                    <h3 className='font-semibold text-gray-800'>{group.speaker}</h3>
                                    <span className='ml-2 text-xs text-gray-500'>
                                        {formatAudioTimestamp(group.startTime)} - {formatAudioTimestamp(group.endTime)}
                                    </span>
                                </div>
                                <div className='ml-6 space-y-2'>
                                    {group.chunks.map((chunk, chunkIndex) => {
                                        const globalIndex = transcribedData.chunks.indexOf(chunk);
                                        const isCurrentChunk = globalIndex === currentChunkIndex;
                                        return (
                                            <div
                                                key={`chunk-${groupIndex}-${chunkIndex}`}
                                                data-chunk-index={globalIndex}
                                                onClick={() => handleChunkClick(chunk.timestamp[0] || 0)}
                                                className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                                                    isCurrentChunk
                                                        ? 'bg-yellow-100 border-l-4 border-yellow-500 shadow-md'
                                                        : transcribedData?.isBusy
                                                        ? 'bg-gray-50 hover:bg-gray-100'
                                                        : 'bg-gray-50 hover:bg-blue-50'
                                                }`}
                                            >
                                                <div className='flex items-start space-x-3'>
                                                    <div className='text-xs text-gray-500 font-mono min-w-[60px] mt-1'>
                                                        {formatAudioTimestamp(chunk.timestamp[0])}
                                                    </div>
                                                    <div className={`text-gray-800 leading-relaxed flex-1 ${
                                                        isCurrentChunk ? 'font-medium' : ''
                                                    }`}>
                                                        {chunk.text}
                                                    </div>
                                                    {chunk.confidence && (
                                                        <div className='text-xs text-gray-400'>
                                                            {Math.round(chunk.confidence * 100)}%
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    ) : (
                        /* Chunks view */
                        transcribedData.chunks.map((chunk, i) => {
                            const isCurrentChunk = i === currentChunkIndex;
                            return (
                                <div
                                    key={`${i}-${chunk.text}`}
                                    data-chunk-index={i}
                                    onClick={() => handleChunkClick(chunk.timestamp[0] || 0)}
                                    className={`w-full flex flex-row mb-2 p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                                        isCurrentChunk
                                            ? 'bg-yellow-100 border-l-4 border-yellow-500 shadow-md'
                                            : transcribedData?.isBusy
                                            ? 'bg-gray-100 hover:bg-gray-200'
                                            : 'bg-gray-50 hover:bg-blue-50'
                                    } shadow-sm border border-gray-100`}
                                >
                                    <div className='mr-4 text-xs text-gray-500 font-mono min-w-[60px] mt-1'>
                                        {formatAudioTimestamp(chunk.timestamp[0])}
                                    </div>
                                    <div className='flex-1'>
                                        {chunk.speaker && (
                                            <div className='flex items-center mb-1'>
                                                <div className={`w-2 h-2 rounded-full mr-2 ${
                                                    chunk.speaker === 'Speaker 1' ? 'bg-blue-500' :
                                                    chunk.speaker === 'Speaker 2' ? 'bg-green-500' :
                                                    chunk.speaker === 'Speaker 3' ? 'bg-purple-500' :
                                                    chunk.speaker === 'Speaker 4' ? 'bg-orange-500' :
                                                    'bg-gray-500'
                                                }`}></div>
                                                <span className='text-xs font-medium text-gray-600'>{chunk.speaker}</span>
                                            </div>
                                        )}
                                        <div className={`text-gray-800 leading-relaxed ${
                                            isCurrentChunk ? 'font-medium' : ''
                                        }`}>
                                            {chunk.text}
                                        </div>
                                    </div>
                                    {chunk.confidence && (
                                        <div className='ml-2 text-xs text-gray-400 self-start mt-1'>
                                            {Math.round(chunk.confidence * 100)}%
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                    <div ref={endOfMessagesRef} />
                </div>
            )}
            
            {/* Export Buttons */}
            {transcribedData && !transcribedData.isBusy && (
                <div className='w-full text-center mt-4'>
                    {exportButtons.map((button, i) => (
                        <button
                            key={i}
                            onClick={button.onClick}
                            className='text-white bg-green-500 hover:bg-green-600 focus:ring-4 focus:ring-green-300 font-medium rounded-lg text-sm px-4 py-2 text-center mr-2 dark:bg-green-600 dark:hover:bg-green-700 dark:focus:ring-green-800 inline-flex items-center transition-colors'
                        >
                            {t("transcript.export")} {button.name}
                        </button>
                    ))}
                </div>
            )}
            
            {/* Statistics */}
            {transcribedData?.tps && (
                <div className='flex flex-wrap justify-center items-center mt-4 space-x-6 text-sm'>
                    <div className='text-center'>
                        <span className='font-semibold text-black'>
                            {transcribedData.tps.toFixed(2)}
                        </span>
                        <span className='text-gray-500 ml-1'>
                            {t("transcript.tokens_per_second")}
                        </span>
                    </div>
                    {transcribedData.chunks && (
                        <div className='text-center text-gray-600'>
                            {t("transcript.total_chunks", { count: transcribedData.chunks.length })}
                        </div>
                    )}
                    {transcribedData.speakerSegments && transcribedData.speakerSegments.length > 0 && (
                        <div className='text-center text-gray-600'>
                            {t("transcript.speaker_segments", { count: transcribedData.speakerSegments.length })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
