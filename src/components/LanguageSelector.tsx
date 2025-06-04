import {
    Menu,
    MenuButton,
    MenuItem,
    MenuItems,
  } from "@headlessui/react";
  import { useTranslation } from "react-i18next";
  import { availableLanguages } from "../i18n";
  
  import CircleFlagsLangSv from "~icons/circle-flags/lang-sv";
  import CircleFlagsLangNo from "~icons/circle-flags/lang-no";
  import CircleFlagsLangEn from "~icons/circle-flags/lang-en";
  import CircleFlagsLangEs from "~icons/circle-flags/lang-es";
  import CircleFlagsLangFr from "~icons/circle-flags/lang-fr";
  
  import { JSX } from "react";
  
  // ———————————————————————————————————————
  // petit helper : "fr-FR" → "fr"
  const baseCode = (lng: string) => lng.split("-")[0].toLowerCase();
  // ———————————————————————————————————————
  
  const languageFlags: Record<string, JSX.Element> = {
    sv: <CircleFlagsLangSv className="inline-block" />,
    no: <CircleFlagsLangNo className="inline-block" />,
    en: <CircleFlagsLangEn className="inline-block" />,
    es: <CircleFlagsLangEs className="inline-block" />,
    fr: <CircleFlagsLangFr className="inline-block" />,
  };
  
  export default function LanguageSelector(props: {
    className?: string;
    currentLanguage: string;
    onChangeLanguage: (newLanguage: string) => void;
  }) {
    const { t } = useTranslation();
  
    const current = baseCode(props.currentLanguage);
  
    return (
      <div className={props.className}>
        <Menu>
          <MenuButton className="flex items-center justify-center rounded-lg p-2 bg-blue text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all duration-200 mr-0">
            <div className="w-7 h-7">
              {/* fallback sur le drapeau EN si jamais */}
              {languageFlags[current] ?? languageFlags["en"]}
            </div>
          </MenuButton>
  
          <MenuItems anchor="bottom end" className="text-right">
            {availableLanguages.map((lng) => (
              <MenuItem key={lng} disabled={lng === current}>
                <button
                  className={`flex items-center justify-end w-full text-right data-[focus]:bg-blue-100 mb-1 ${
                    lng === current ? "font-bold" : ""
                  }`}
                  onClick={() => props.onChangeLanguage(lng)}
                >
                  <span className="mr-2">{languageFlags[lng]}</span>
                  {t(`language_selector.${lng}`)}
                </button>
              </MenuItem>
            ))}
          </MenuItems>
        </Menu>
      </div>
    );
  }
  