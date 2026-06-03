import AudioManager from "./components/AudioManager";
import LiveTranscriptionPanel from "./components/LiveTranscriptionPanel";
import Transcript from "./components/Transcript";
import { useTranscriber } from "./hooks/useTranscriber";
import { Trans, useTranslation } from "react-i18next";
import LanguageSelector from "./components/LanguageSelector";
import { useEffect, useState, useCallback } from "react";

const SHOW_CREDITS = import.meta.env.VITE_SHOW_CREDITS === "true";

function App() {
    const transcriber = useTranscriber();
    const [currentTime, setCurrentTime] = useState<number>(0);
    const [seekTime, setSeekTime] = useState<number | undefined>(undefined);
    const [showLivePanel, setShowLivePanel] = useState(false);

    const { i18n, t } = useTranslation();
    const [currentLanguage, setCurrentLanguage] = useState(i18n.language);

    const handleChangeLanguage = (newLanguage: string) => {
        setCurrentLanguage(newLanguage);
        i18n.changeLanguage(newLanguage);
    };

    const handleTimeUpdate = useCallback((time: number) => {
        setCurrentTime(time);
    }, []);

    const handleSeek = useCallback((time: number) => {
        setSeekTime(time);
        setCurrentTime(time);
        // Reset seekTime after a short delay to avoid continuous seeking
        setTimeout(() => setSeekTime(undefined), 100);
    }, []);

    const handleLiveRequested = useCallback(() => {
        setShowLivePanel(true);
        window.setTimeout(() => {
            document
                .getElementById("live-transcription-panel")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 50);
    }, []);

    useEffect(() => {
        setCurrentLanguage(i18n.language);
    }, [i18n.language]);

    return (
        <>
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-blue-800 focus:shadow-lg focus:ring-2 focus:ring-blue-700"
            >
                {t("app.skip_to_content")}
            </a>
            <main
                id="main-content"
                className='flex flex-col justify-center items-center min-h-screen px-3 pt-20 pb-24 sm:px-4 sm:pt-4'
            >
                <div className='flex w-full max-w-6xl flex-col justify-center items-center'>
                    <h1 className='text-4xl font-extrabold tracking-tight text-slate-900 min-[380px]:text-5xl sm:text-7xl text-center'>
                        {t("app.title")}
                    </h1>
                    <h2 className='mt-3 mb-5 px-4 text-center text-1xl font-semibold tracking-tight text-slate-900 sm:text-2xl'>
                        {t("app.subtitle")}
                    </h2>
                    <AudioManager 
                        transcriber={transcriber}
                        onTimeUpdate={handleTimeUpdate}
                        currentTime={seekTime}
                        onSeek={handleSeek}
                        onLiveRequested={handleLiveRequested}
                    />
                    <Transcript 
                        transcribedData={transcriber.output} 
                        interimTranscript={transcriber.interimTranscript}
                        currentTime={currentTime}
                        onSeek={handleSeek}
                    />
                    {showLivePanel && <LiveTranscriptionPanel />}
                </div>


                <footer className='text-center m-4'>
                    <b>{t("app.footer")}</b>
                    <br />
                    {SHOW_CREDITS && (
                    <Trans
                        i18nKey='app.footer_credits'
                        components={{
                            authorLink: (
                                <a
                                    className='underline'
                                    href='https://github.com/PierreMesure/whisper-web'
                                />
                            ),
                            demoLink: (
                                <a
                                    className='underline'
                                    href='https://github.com/Xenova/whisper-web'
                                />
                            ),
                        }}
                    />
                    )}
                </footer>
            </main>
            <LanguageSelector
                className='fixed top-4 right-16'
                currentLanguage={currentLanguage}
                onChangeLanguage={handleChangeLanguage}
            />
        </>
    );
}

export default App;
