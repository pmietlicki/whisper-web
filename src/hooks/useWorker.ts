import { useEffect, useRef, useState } from "react";

export interface MessageEventHandler {
    (event: MessageEvent): void;
}

export function useWorker(messageEventHandler: MessageEventHandler): Worker {
    const messageEventHandlerRef = useRef(messageEventHandler);

    useEffect(() => {
        messageEventHandlerRef.current = messageEventHandler;
    }, [messageEventHandler]);

    // Create new worker once and never again
    const [worker] = useState(() =>
        createWorker((event) => messageEventHandlerRef.current(event)),
    );

    useEffect(() => {
        return () => worker.terminate();
    }, [worker]);

    return worker;
}

function createWorker(messageEventHandler: MessageEventHandler): Worker {
    const worker = new Worker(new URL("../worker.js", import.meta.url), {
        type: "module",
    });
    // Listen for messages from the Web Worker
    worker.addEventListener("message", messageEventHandler);
    return worker;
}
