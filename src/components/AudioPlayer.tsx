import { useEffect, useRef } from 'react';

export default function AudioPlayer(props: {
    audioUrl: string;
    mimeType: string;
}) {
    const mediaPlayer = useRef<HTMLAudioElement | HTMLVideoElement>(null);
    const mediaSource = useRef<HTMLSourceElement>(null);
    
    // Détermine si c'est une vidéo
    const isVideo = props.mimeType.startsWith('video/');

    // Updates src when url changes
    useEffect(() => {
        if (mediaPlayer.current && mediaSource.current) {
            mediaSource.current.src = props.audioUrl;
            mediaPlayer.current.load();
        }
    }, [props.audioUrl]);

    return (
        <div className='sticky bottom-0 w-full p-4 bg-white border-t border-slate-200 shadow-lg z-50 mt-8'>
            <div className='w-full max-w-4xl mx-auto'>
                {isVideo ? (
                    <video
                        ref={mediaPlayer as React.RefObject<HTMLVideoElement>}
                        controls
                        className='w-full max-h-96 rounded-lg bg-black shadow-xl shadow-black/5 ring-1 ring-slate-700/10'
                    >
                        <source ref={mediaSource} type={props.mimeType}></source>
                    </video>
                ) : (
                    <audio
                        ref={mediaPlayer as React.RefObject<HTMLAudioElement>}
                        controls
                        className='w-full h-14 rounded-lg bg-white shadow-xl shadow-black/5 ring-1 ring-slate-700/10'
                    >
                        <source ref={mediaSource} type={props.mimeType}></source>
                    </audio>
                )}
            </div>
        </div>
    );
}