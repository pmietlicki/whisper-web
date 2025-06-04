import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import enJSON from "./locale/en.json";
import svJSON from "./locale/sv.json";
import noJSON from "./locale/no.json";
import esJSON from "./locale/es.json";
import frJSON from "./locale/fr.json";

const resources = {
    en: { ...enJSON },
    sv: { ...svJSON },
    no: { ...noJSON },
    es: { ...esJSON },
    fr: {...frJSON },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init(
    {
      resources,
      fallbackLng: "en",
      supportedLngs: Object.keys(resources),
      load: "languageOnly",
      detection: {
        order: ["localStorage", "navigator", "htmlTag", "path", "subdomain"],
        lookupLocalStorage: "lng",
        caches: ["localStorage"],
      },
      interpolation: { escapeValue: false },
    },
    () => {
      // ► Normalisation en 2 lettres minuscules
      const code = i18n.language.slice(0, 2).toLowerCase();
      if (i18n.language !== code) {
        i18n.changeLanguage(code);       // met i18next à jour
        localStorage.setItem("lng", code); // met à jour la clé cache
      }
    },
  );

export const availableLanguages = Object.keys(resources);
export default i18n;