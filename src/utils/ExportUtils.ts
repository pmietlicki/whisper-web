import { TranscriberData } from "../hooks/useTranscriber";
import {  formatSrtTimeRange } from "./AudioUtils";

export const saveBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
};

export const exportTXT = (transcribedData: TranscriberData | undefined, viewMode: 'chunks' | 'speakers', speakerGroups: any[]) => {
    const chunks = transcribedData?.chunks ?? [];
    let text = "";
    
    if (viewMode === 'speakers' && speakerGroups.length > 0) {
        for (const group of speakerGroups) {
            text += `${group.speaker}:\n`;
            text += group.chunks.map((chunk: { text: string }) => chunk.text).join(" ").trim() + "\n\n";
        }
    } else {
        text = chunks.map((chunk) => chunk.text).join(" ").trim();
    }

    const blob = new Blob([text], { type: "text/plain" });
    saveBlob(blob, "transcript.txt");
};

export const exportJSON = (transcribedData: TranscriberData | undefined) => {
    const exportData = {
        chunks: transcribedData?.chunks ?? [],
        speakerSegments: transcribedData?.speakerSegments ?? [],
        metadata: {
            exportDate: new Date().toISOString(),
            totalDuration: transcribedData?.chunks?.length ? 
                Math.max(...transcribedData.chunks.map(c => c.timestamp[1] || c.timestamp[0] || 0)) : 0
        }
    };
    
    let jsonData = JSON.stringify(exportData, null, 2);
    const regex = /(\s{4}"timestamp": )\[\s+(\S+)\s+(\S+)\s+\]/gm;
    jsonData = jsonData.replace(regex, "$1[$2 $3]");

    const blob = new Blob([jsonData], { type: "application/json" });
    saveBlob(blob, "transcript.json");
};

export const exportSRT = (transcribedData: TranscriberData | undefined) => {
    const chunks = transcribedData?.chunks ?? [];
    let srt = "";
    
    for (let i = 0; i < chunks.length; i++) {
        srt += `${i + 1}\n`;
        srt += `${formatSrtTimeRange(chunks[i].timestamp[0], chunks[i].timestamp[1] ?? chunks[i].timestamp[0])}\n`;
        
        const text = chunks[i].speaker ? 
            `${chunks[i].speaker}: ${chunks[i].text}` : 
            chunks[i].text;
        srt += `${text}\n\n`;
    }
    
    const blob = new Blob([srt], { type: "text/plain" });
    saveBlob(blob, "transcript.srt");
};