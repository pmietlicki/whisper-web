// src/utils/DiarizationUtils.ts

import { SpeakerSegment } from '../types/transcriber'; // Assurez-vous que le chemin est correct

/**
 * Options pour la fonction de nettoyage dynamique.
 * Tous les paramètres sont optionnels. S'ils ne sont pas fournis, la fonction utilisera des valeurs dynamiques ou par défaut.
 */
interface CleanDiarizationOptions {
    minSpeakingTime?: number;
    minSegmentDuration?: number;
    maxGapSeconds?: number; // Si cette valeur est fournie, elle remplace le calcul dynamique.
}

/**
 * Calcule un seuil de silence intelligent en se basant sur le rythme de la conversation.
 * @param segments - La liste de tous les segments de parole.
 * @returns La durée maximale (en sec) d'un silence à considérer comme une simple pause.
 */
function calculateDynamicGap(segments: SpeakerSegment[]): number {
    const defaultGap = 1.5; // Valeur de repli si le calcul est impossible.
    if (segments.length < 2) {
        return defaultGap;
    }

    const gaps: number[] = [];
    for (let i = 0; i < segments.length - 1; i++) {
        const gap = segments[i + 1].start - segments[i].end;
        if (gap > 0) {
            gaps.push(gap);
        }
    }

    if (gaps.length < 1) {
        return defaultGap;
    }

    // Utiliser la médiane pour être robuste aux longs silences (outliers)
    gaps.sort((a, b) => a - b);
    const medianGap = gaps[Math.floor(gaps.length / 2)];

    // On définit le seuil comme étant un peu plus grand que la médiane des pauses.
    // Cela permet de fusionner les pauses courtes et moyennes, mais de séparer les longues.
    const calculatedGap = medianGap + 0.5;

    // On s'assure que le seuil reste dans des limites raisonnables (entre 0.5s et 3s)
    return Math.max(0.5, Math.min(calculatedGap, 3.0));
}

function consolidateTurnsForSpeaker(segments: SpeakerSegment[], maxGapSeconds: number): SpeakerSegment[] {
    if (segments.length < 2) return segments;
    const consolidated: SpeakerSegment[] = [];
    let currentTurn = { ...segments[0] };

    for (let i = 1; i < segments.length; i++) {
        const nextTurn = segments[i];
        const gap = nextTurn.start - currentTurn.end;
        if (gap <= maxGapSeconds) {
            currentTurn.end = nextTurn.end;
        } else {
            consolidated.push(currentTurn);
            currentTurn = { ...nextTurn };
        }
    }
    consolidated.push(currentTurn);
    return consolidated;
}

export function cleanDiarization(
    segments: SpeakerSegment[],
    options: CleanDiarizationOptions = {}
): SpeakerSegment[] {
    const {
        minSpeakingTime = 1.0,
        minSegmentDuration = 0.2,
    } = options;

    if (!segments || segments.length === 0) return [];

    const speechSegments = segments.filter(s => s.label.startsWith('SPEAKER_'));
    if (speechSegments.length === 0) return [];
    
    // --- ÉTAPE 1: Calcul dynamique du seuil de silence ---
    // Si maxGapSeconds n'est pas fourni dans les options, on le calcule.
    const maxGapSeconds = options.maxGapSeconds ?? calculateDynamicGap(speechSegments);

    // --- ÉTAPE 2: Identification dynamique des locuteurs principaux ---
    const speakerTimes = new Map<string, number>();
    speechSegments.forEach(seg => {
        const duration = seg.end - seg.start;
        speakerTimes.set(seg.label, (speakerTimes.get(seg.label) || 0) + duration);
    });

    const mainSpeakers = new Set<string>();
    for (const [label, time] of speakerTimes.entries()) {
        if (time >= minSpeakingTime) {
            mainSpeakers.add(label);
        }
    }
    
    if (mainSpeakers.size === 0) return [];

    // --- ÉTAPE 3: Filtrage et Consolidation ---
    const validSegments = speechSegments.filter(seg =>
        mainSpeakers.has(seg.label) && (seg.end - seg.start) >= minSegmentDuration
    );

    const segmentsBySpeaker = new Map<string, SpeakerSegment[]>();
    validSegments.forEach(seg => {
        if (!segmentsBySpeaker.has(seg.label)) {
            segmentsBySpeaker.set(seg.label, []);
        }
        segmentsBySpeaker.get(seg.label)!.push(seg);
    });

    let finalSegments: SpeakerSegment[] = [];
    for (const speakerTurns of segmentsBySpeaker.values()) {
        const consolidatedTurns = consolidateTurnsForSpeaker(speakerTurns, maxGapSeconds);
        finalSegments.push(...consolidatedTurns);
    }

    // --- ÉTAPE 4: Tri final ---
    finalSegments.sort((a, b) => a.start - b.start);

    return finalSegments;
}