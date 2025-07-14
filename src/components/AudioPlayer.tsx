import React, { useRef, useEffect, useCallback } from "react";

interface AudioPlayerProps {
    audioUrl: string;
    mimeType: string;
    onTimeUpdate?: (currentTime: number) => void;
    onSeek?: (time: number) => void;
    currentTime?: number;
}

export default function AudioPlayer({
    audioUrl,
    mimeType,
    onTimeUpdate,
    onSeek,
    currentTime
}: AudioPlayerProps) {
    const mediaPlayer = useRef<HTMLAudioElement | HTMLVideoElement>(null);
    const mediaSource = useRef<HTMLSourceElement>(null);
    // Détermine si c'est une vidéo
    const isVideo = mimeType.startsWith('video/');

    // Handle time updates
    const handleTimeUpdate = useCallback(() => {
        if (mediaPlayer.current && onTimeUpdate) {
            onTimeUpdate(mediaPlayer.current.currentTime);
        }
    }, [onTimeUpdate]);

    // Handle seeking
    const handleSeek = useCallback((time: number) => {
        if (mediaPlayer.current) {
            mediaPlayer.current.currentTime = time;
            if (onSeek) {
                onSeek(time);
            }
        }
    }, [onSeek]);

    // Handle external seek requests
    useEffect(() => {
        if (mediaPlayer.current && currentTime !== undefined) {
            const timeDiff = Math.abs(mediaPlayer.current.currentTime - currentTime);
            // Only seek if the difference is significant (more than 0.5 seconds)
            if (timeDiff > 0.5) {
                mediaPlayer.current.currentTime = currentTime;
            }
        }
    }, [currentTime]);

    // Updates src when url changes
    useEffect(() => {
        if (mediaPlayer.current && mediaSource.current) {
            mediaSource.current.src = audioUrl;
            mediaPlayer.current.load();
        }
    }, [audioUrl]);

    // Setup event listeners
    useEffect(() => {
        const player = mediaPlayer.current;
        if (!player) return;

        player.addEventListener('timeupdate', handleTimeUpdate);

        return () => {
            player.removeEventListener('timeupdate', handleTimeUpdate);
        };
    }, [handleTimeUpdate]);

    // Expose seek function
    useEffect(() => {
        if (mediaPlayer.current) {
            (mediaPlayer.current as any).seekTo = handleSeek;
        }
    }, [handleSeek]);

    return (
        <div className='sticky bottom-0 w-full p-4 bg-white border-t border-slate-200 shadow-lg z-50 mt-8'>
            <div className='w-full max-w-4xl mx-auto'>
                {isVideo ? (
                    <video
                        ref={mediaPlayer as React.RefObject<HTMLVideoElement>}
                        controls
                        className='w-full max-h-96 rounded-lg bg-black shadow-xl shadow-black/5 ring-1 ring-slate-700/10'
                    >
                        <source ref={mediaSource} type={mimeType}></source>
                    </video>
                ) : (
                    <audio
                        ref={mediaPlayer as React.RefObject<HTMLAudioElement>}
                        controls
                        className='w-full h-14 rounded-lg bg-white shadow-xl shadow-black/5 ring-1 ring-slate-700/10'
                    >
                        <source ref={mediaSource} type={mimeType}></source>
                    </audio>
                )}
            </div>
        </div>
    );
}