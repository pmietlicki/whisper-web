import AudioManager from "./components/AudioManager";
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
                className='flex flex-col justify-center items-center min-h-screen py-4 pb-24'
            >
                <div className='container flex flex-col justify-center items-center'>
                    <h1 className='text-5xl font-extrabold tracking-tight text-slate-900 sm:text-7xl text-center'>
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
                    />
                    <Transcript 
                        transcribedData={transcriber.output} 
                        interimTranscript={transcriber.interimTranscript}
                        currentTime={currentTime}
                        onSeek={handleSeek}
                    />
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
