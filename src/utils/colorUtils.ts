// src/utils/colorUtils.ts

// Palette de couleurs accessibles et distinctes
const SPEAKER_COLORS = [
    { bg: 'bg-blue-500', text: 'text-blue-800', border: 'border-blue-500' },
    { bg: 'bg-green-500', text: 'text-green-800', border: 'border-green-500' },
    { bg: 'bg-purple-500', text: 'text-purple-800', border: 'border-purple-500' },
    { bg: 'bg-orange-500', text: 'text-orange-800', border: 'border-orange-500' },
    { bg: 'bg-red-500', text: 'text-red-800', border: 'border-red-500' },
    { bg: 'bg-teal-500', text: 'text-teal-800', border: 'border-teal-500' },
    { bg: 'bg-pink-500', text: 'text-pink-800', border: 'border-pink-500' },
];

const DEFAULT_COLOR = {
    bg: 'bg-gray-500',
    text: 'text-gray-800',
    border: 'border-gray-500'
};

/**
 * Attribue une couleur à un locuteur de manière déterministe.
 * @param speakerLabel - L'étiquette du locuteur (ex: "Speaker 1").
 * @returns Un objet contenant les classes de couleur pour Tailwind CSS.
 */
export const getSpeakerColor = (speakerLabel?: string) => {
    if (!speakerLabel) return DEFAULT_COLOR;

    // Utilise une fonction de hash simple pour garantir la cohérence des couleurs
    let hash = 0;
    for (let i = 0; i < speakerLabel.length; i++) {
        const char = speakerLabel.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0; // Convert to 32bit integer
    }

    const index = Math.abs(hash % SPEAKER_COLORS.length);
    return SPEAKER_COLORS[index];
};