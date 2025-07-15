// src/components/TranscriptChunk.tsx

import { memo } from 'react';
import { Chunk } from '../types/transcriber';
import { formatAudioTimestamp } from '../utils/AudioUtils';
import { getSpeakerColor } from '../utils/colorUtils';

interface Props {
    chunk: Chunk;
    isCurrent: boolean;
    isBusy: boolean;
    showSpeaker: boolean; // Pour afficher ou non le nom du locuteur dans le chunk
    onClick: () => void;
}

// Utilisation de `memo` pour éviter les re-rendus inutiles des chunks qui ne changent pas.
export const TranscriptChunk = memo(({ chunk, isCurrent, isBusy, showSpeaker, onClick }: Props) => {
    const color = getSpeakerColor(chunk.speaker);

    const chunkClasses = `w-full flex flex-row mb-2 p-3 rounded-lg cursor-pointer transition-all duration-200 shadow-sm border ${
        isCurrent
            ? `bg-yellow-100 border-l-4 ${color.border} shadow-md`
            : isBusy
            ? 'bg-gray-100 hover:bg-gray-200 border-gray-100'
            : 'bg-gray-50 hover:bg-blue-50 border-gray-100'
    }`;

    return (
        <div onClick={onClick} className={chunkClasses}>
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
    );
});