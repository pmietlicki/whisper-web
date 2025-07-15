import AudioManager from "./components/AudioManager";
import Transcript from "./components/Transcript";
import { useTranscriber } from "./hooks/useTranscriber";
import { Trans, useTranslation } from "react-i18next";
import LanguageSelector from "./components/LanguageSelector";
// 1. Importer `useMemo`
import { useEffect, useState, useCallback, useMemo } from "react";

// 2. Importer la fonction de nettoyage
import { cleanDiarization } from "./utils/DiarizationUtils"; 

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
        setTimeout(() => setSeekTime(undefined), 100);
    }, []);

    useEffect(() => {
        setCurrentLanguage(i18n.language);
    }, [i18n.language]);

    const cleanedTranscribedData = useMemo(() => {
        if (!transcriber.output) {
            return undefined;
        }

        const rawSegments = transcriber.output.speakerSegments || [];
        const cleanedSegments = cleanDiarization(rawSegments); 

        return {
            ...transcriber.output,
            speakerSegments: cleanedSegments,
        };
    }, [transcriber.output]);

    return (
        <>
            <div className='flex flex-col justify-center items-center min-h-screen py-4 pb-24'>
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
                        // 3. Utiliser les données nettoyées ici
                        transcribedData={cleanedTranscribedData} 
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
            </div>
            <LanguageSelector
                className='fixed top-4 right-16'
                currentLanguage={currentLanguage}
                onChangeLanguage={handleChangeLanguage}
            />
        </>
    );
}

export default App;