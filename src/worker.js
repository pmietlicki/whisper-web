import { pipeline, WhisperTextStreamer } from "@huggingface/transformers";
import { DTYPES } from "./utils/Constants";

// Define model factories
// Ensures only one model is created of each type
class PipelineFactory {
    static task = null;
    static model = null;
    static dtype = null;
    static gpu = false;
    static instance = null;

    constructor(tokenizer, model, dtype, gpu) {
        this.tokenizer = tokenizer;
        this.model = model;
        this.dtype = dtype;
        this.gpu = gpu;
    }

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            let dtype = this.dtype;

            // Convert single dtype to model-wide options
            if (typeof dtype === "string") {
                if (!DTYPES.includes(dtype)) {
                    console.warn(
                        `Invalid dtype "${dtype}" provided, falling back to \"fp32\"`,
                    );
                    dtype = "fp32";
                }
                dtype = {
                    encoder_model: dtype,
                    decoder_model_merged: dtype,
                };
            } else if (dtype && typeof dtype === "object") {
                // Validate object entries
                for (const k in dtype) {
                    if (!DTYPES.includes(dtype[k])) {
                        console.warn(
                            `Invalid dtype "${dtype[k]}" for ${k}, using \"fp32\"`,
                        );
                        dtype[k] = "fp32";
                    }
                }
            } else {
                dtype = {
                    encoder_model: "fp32",
                    decoder_model_merged: "fp32",
                };
            }
            const options = {
                dtype,
                device: this.gpu ? "webgpu" : "wasm",
                progress_callback,
            };

            try {
                this.instance = await pipeline(this.task, this.model, options);
            } catch (error) {
                if (this.instance !== null) {
                    try {
                        await this.instance.dispose();
                    } catch (_) {
                        // ignore
                    }
                    this.instance = null;
                }

                if (this.gpu) {
                    console.warn(
                        "WebGPU failed, falling back to CPU",
                        error,
                    );
                    this.gpu = false;
                    options.device = "wasm";
                    try {
                        this.instance = await pipeline(
                            this.task,
                            this.model,
                            options,
                        );
                    } catch (error2) {
                        if (this.instance !== null) {
                            try {
                                await this.instance.dispose();
                            } catch (_) {
                                // ignore
                            }
                            this.instance = null;
                        }
                        throw error2;
                    }
                } else {
                    throw error;
                }
            }
        }

        return this.instance;
    }
}

self.addEventListener("message", async (event) => {
    const message = event.data;

    // Do some work...
    // TODO use message data
    let transcript = await transcribe(message);
    if (transcript === null) return;

    // Send the result back to the main thread
    self.postMessage({
        status: "complete",
        data: transcript,
    });
});

class AutomaticSpeechRecognitionPipelineFactory extends PipelineFactory {
    static task = "automatic-speech-recognition";
    static model = null;
    static dtype = null;
    static gpu = false;
}

const transcribe = async ({ audio, model, dtype, gpu, subtask, language }) => {
    const isDistilWhisper = model.startsWith("distil-whisper/");

    const p = AutomaticSpeechRecognitionPipelineFactory;
    if (p.model !== model || p.dtype !== dtype || p.gpu !== gpu) {
        // Invalidate model if different model, dtype, or gpu setting
        p.model = model;
        p.dtype = dtype;
        p.gpu = gpu;

        if (p.instance !== null) {
            (await p.getInstance()).dispose();
            p.instance = null;
        }
    }

    // Load transcriber model
    const transcriber = await p.getInstance((data) => {
        self.postMessage(data);
    });

    const time_precision =
        transcriber.processor.feature_extractor.config.chunk_length /
        transcriber.model.config.max_source_positions;

    // Storage for chunks to be processed. Initialise with an empty chunk.
    /** @type {{ text: string; offset: number, timestamp: [number, number | null] }[]} */
    const chunks = [];

    // TODO: Storage for fully-processed and merged chunks
    // let decoded_chunks = [];

    const chunk_length_s = isDistilWhisper ? 20 : 30;
    const stride_length_s = isDistilWhisper ? 3 : 5;

    let chunk_count = 0;
    let start_time;
    let num_tokens = 0;
    let tps;
    const streamer = new WhisperTextStreamer(transcriber.tokenizer, {
        time_precision,
        on_chunk_start: (x) => {
            const offset = (chunk_length_s - stride_length_s) * chunk_count;
            chunks.push({
                text: "",
                timestamp: [offset + x, null],
                finalised: false,
                offset,
            });
        },
        token_callback_function: (x) => {
            start_time ??= performance.now();
            if (num_tokens++ > 0) {
                tps = (num_tokens / (performance.now() - start_time)) * 1000;
            }
        },
        callback_function: (x) => {
            if (chunks.length === 0) return;
            // Append text to the last chunk
            chunks.at(-1).text += x;

            self.postMessage({
                status: "update",
                data: {
                    text: "", // No need to send full text yet
                    chunks,
                    tps,
                },
            });
        },
        on_chunk_end: (x) => {
            const current = chunks.at(-1);
            current.timestamp[1] = x + current.offset;
            current.finalised = true;
        },
        on_finalize: () => {
            start_time = null;
            num_tokens = 0;
            ++chunk_count;
        },
    });

    // Options for the transcription call
    const params = {
        // Greedy
        top_k: 0,
        do_sample: false,

        // Sliding window
        chunk_length_s,
        stride_length_s,

        // Language and task
        language,
        task: subtask,

        // Return timestamps
        return_timestamps: true,
        force_full_sequences: false,

        // Callback functions
        streamer, // after each generation step
    };

    let output;
    try {
        // Actually run transcription
        output = await transcriber(audio, params);
    } catch (error) {
        console.error(error);
        if (gpu) {
            try {
                (await p.getInstance()).dispose();
            } catch (_) {
                // ignore
            }
            p.instance = null;
            p.gpu = false;
            try {
                const cpuTranscriber = await p.getInstance((data) => {
                    self.postMessage(data);
                });
                output = await cpuTranscriber(audio, params);
            } catch (error2) {
                console.error(error2);
                self.postMessage({
                    status: "error",
                    data: error2,
                });
                return null;
            }
        } else {
            self.postMessage({
                status: "error",
                data: error,
            });
            return null;
        }
    }

    return {
        tps,
        ...output,
    };
};
