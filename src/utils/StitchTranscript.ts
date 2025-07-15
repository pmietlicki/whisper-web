// src/utils/stitchTranscript.ts

import { Chunk, SpeakerSegment } from '../types/transcriber';

/**
 * Attribue un locuteur à chaque chunk de texte en se basant sur un "vote"
 * des segments de diarization qui se superposent.
 * C'est une méthode très robuste pour corriger les erreurs d'attribution.
 *
 * @param chunks - La liste des chunks de texte transcrits (de l'ASR).
 * @param speakerSegments - La liste des segments de locuteurs bruts (de la diarization).
 * @returns Une nouvelle liste de chunks, chacun avec une propriété `speaker` corrigée.
 */
export function stitchTranscriptWithSpeakers(
    chunks: Chunk[],
    speakerSegments: SpeakerSegment[]
): Chunk[] {
    if (!chunks?.length || !speakerSegments?.length) {
        return chunks;
    }

    // Crée une copie pour ne pas modifier les données originales
    const stitchedChunks: Chunk[] = JSON.parse(JSON.stringify(chunks));

    // Pour chaque chunk de texte...
    for (const chunk of stitchedChunks) {
        const [chunkStart, chunkEnd] = chunk.timestamp;
        if (chunkEnd === null) continue;

        // Faisons voter les locuteurs pour ce chunk
        const speakerVotes = new Map<string, number>();

        // Trouver tous les segments de locuteur qui se superposent à ce chunk
        for (const seg of speakerSegments) {
            if (seg.label === 'NO_SPEAKER') continue;

            // Calculer l'intersection entre le chunk et le segment de locuteur
            const overlapStart = Math.max(chunkStart, seg.start);
            const overlapEnd = Math.min(chunkEnd, seg.end);
            const overlapDuration = overlapEnd - overlapStart;

            // Si l'intersection est positive, le locuteur gagne des "voix" (sa durée de parole)
            if (overlapDuration > 0) {
                speakerVotes.set(seg.label, (speakerVotes.get(seg.label) || 0) + overlapDuration);
            }
        }

        // Si personne n'a voté pour ce chunk, on continue
        if (speakerVotes.size === 0) {
            continue;
        }

        // Trouver le locuteur qui a le plus de temps de parole (le vainqueur du vote)
        const winner = [...speakerVotes.entries()].sort((a, b) => b[1] - a[1])[0];
        chunk.speaker = winner[0];
    }

    return stitchedChunks;
}