import { useEffect, useRef } from "react";

export default function AudioPlayer(props: {
    audioUrl: string;
    mimeType: string;
}) {
    const audioPlayer = useRef<HTMLAudioElement>(null);
    const audioSource = useRef<HTMLSourceElement>(null);

    // Updates src when url changes
    useEffect(() => {
        if (audioPlayer.current && audioSource.current) {
            audioSource.current.src = props.audioUrl;
            audioPlayer.current.load();
        }
    }, [props.audioUrl]);

    return (
        <div className='fixed bottom-0 left-0 right-0 z-50 p-4 bg-white border-t border-slate-200 shadow-lg flex justify-center'>
            <div className='w-full max-w-2xl'>
                <audio
                    ref={audioPlayer}
                    controls
                    className='w-full h-14 rounded-lg bg-white shadow-xl shadow-black/5 ring-1 ring-slate-700/10'
                >
                    <source ref={audioSource} type={props.mimeType}></source>
                </audio>
            </div>
        </div>
    );
}
