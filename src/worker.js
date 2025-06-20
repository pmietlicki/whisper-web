import { pipeline, env } from "@huggingface/transformers";
import { MessageTypes } from "./utils/MessageTypes";
import { WhisperTextStreamer } from "./utils/WhisperTextStreamer";

// Speaker diarization model
class SpeakerDiarizationPipeline {
    static task = 'feature-extraction';
    static model = 'Xenova/wavlm-base-plus-sv';
    static instance = null;

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            this.instance = pipeline(this.task, this.model, { progress_callback });
        }
        return this.instance;
    }
}

// Speaker diarization utilities
function cosine_similarity(a, b) {
    let dot_product = 0;
    let norm_a = 0;
    let norm_b = 0;
    for (let i = 0; i < a.length; i++) {
        dot_product += a[i] * b[i];
        norm_a += a[i] * a[i];
        norm_b += b[i] * b[i];
    }
    return dot_product / (Math.sqrt(norm_a) * Math.sqrt(norm_b));
}

function cluster_speakers(embeddings, threshold = 0.7) {
    const clusters = [];
    const assignments = new Array(embeddings.length).fill(-1);
    
    for (let i = 0; i < embeddings.length; i++) {
        if (assignments[i] !== -1) continue;
        
        const cluster = [i];
        assignments[i] = clusters.length;
        
        for (let j = i + 1; j < embeddings.length; j++) {
            if (assignments[j] !== -1) continue;
            
            const similarity = cosine_similarity(embeddings[i], embeddings[j]);
            if (similarity > threshold) {
                cluster.push(j);
                assignments[j] = clusters.length;
            }
        }
        
        clusters.push(cluster);
    }
    
    return assignments;
}

async function performSpeakerDiarization(audio, chunks) {
    try {
        const diarizer = await SpeakerDiarizationPipeline.getInstance();
        
        // Extract embeddings for each chunk
        const embeddings = [];
        const validChunks = [];
        
        for (const chunk of chunks) {
            if (chunk.timestamp[0] !== null && chunk.timestamp[1] !== null) {
                const start_sample = Math.floor(chunk.timestamp[0] * 16000);
                const end_sample = Math.floor(chunk.timestamp[1] * 16000);
                
                if (start_sample < audio.length && end_sample <= audio.length && end_sample > start_sample) {
                    const chunk_audio = audio.slice(start_sample, end_sample);
                    
                    if (chunk_audio.length > 1600) { // At least 0.1 seconds
                        const { data } = await diarizer(chunk_audio);
                        embeddings.push(Array.from(data));
                        validChunks.push(chunk);
                    }
                }
            }
        }
        
        if (embeddings.length === 0) {
            return { chunks, speakerSegments: [] };
        }
        
        // Cluster speakers
        const speaker_assignments = cluster_speakers(embeddings);
        
        // Assign speakers to chunks
        const chunksWithSpeakers = chunks.map(chunk => ({ ...chunk }));
        for (let i = 0; i < validChunks.length; i++) {
            const chunkIndex = chunks.indexOf(validChunks[i]);
            if (chunkIndex !== -1) {
                chunksWithSpeakers[chunkIndex].speaker = `Speaker ${speaker_assignments[i] + 1}`;
            }
        }
        
        // Create speaker segments
        const speakerSegments = [];
        let currentSpeaker = null;
        let segmentStart = null;
        
        for (const chunk of chunksWithSpeakers) {
            if (chunk.speaker && chunk.timestamp[0] !== null) {
                if (currentSpeaker !== chunk.speaker) {
                    if (currentSpeaker !== null && segmentStart !== null) {
                        speakerSegments.push({
                            speaker: currentSpeaker,
                            start: segmentStart,
                            end: chunk.timestamp[0]
                        });
                    }
                    currentSpeaker = chunk.speaker;
                    segmentStart = chunk.timestamp[0];
                }
            }
        }
        
        // Add final segment
        if (currentSpeaker !== null && segmentStart !== null) {
            const lastChunk = chunksWithSpeakers[chunksWithSpeakers.length - 1];
            if (lastChunk && lastChunk.timestamp[1] !== null) {
                speakerSegments.push({
                    speaker: currentSpeaker,
                    start: segmentStart,
                    end: lastChunk.timestamp[1]
                });
            }
        }
        
        return { chunks: chunksWithSpeakers, speakerSegments };
    } catch (error) {
        console.warn('Speaker diarization failed:', error);
        return { chunks, speakerSegments: [] };
    }
}

// Configuration explicite et robuste des chemins WASM
if (typeof window === 'undefined') {
    // Dans un worker, configurer les chemins WASM avec fallbacks
    import('@huggingface/transformers').then(({ env }) => {
        try {
            // Configuration principale
            env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@latest/dist/';
            env.backends.onnx.wasm.numThreads = 1;
            env.backends.onnx.wasm.simd = true;
            
            // Configuration additionnelle pour éviter les erreurs d'initialisation
            env.backends.onnx.wasm.proxy = false;
            env.allowLocalModels = false;
            env.allowRemoteModels = true;
            env.useBrowserCache = true;
            env.useCustomCache = false;
            
            console.log('WASM configuration applied successfully');
        } catch (configError) {
            console.error('Error during WASM configuration:', configError);
        }
    }).catch(importError => {
        console.error('Error importing transformers:', importError);
    });
}

// Fonction de diagnostic de l'environnement
const checkEnvironment = () => {
    const diagnostics = {
        webgpu: false,
        wasm: false,
        simd: false,
        threads: false
    };
    
    try {
        // Vérifier WebGPU
        diagnostics.webgpu = 'gpu' in navigator;
        
        // Vérifier WebAssembly
        diagnostics.wasm = typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function';
        
        // Vérifier SIMD
        diagnostics.simd = typeof WebAssembly.SIMD !== 'undefined';
        
        // Vérifier les Web Workers avec SharedArrayBuffer
        diagnostics.threads = typeof SharedArrayBuffer !== 'undefined';
        
    } catch (error) {
        console.warn('Error during diagnostics:', error);
    }
    
    console.log('Environment diagnostics:', diagnostics);
    return diagnostics;
};

// Fonction pour précharger les fichiers WASM
const preloadWasmFiles = async () => {
    const wasmFiles = [
        'ort-wasm.wasm',
        'ort-wasm-simd.wasm',
        'ort-wasm-threaded.wasm',
        'ort-wasm-simd-threaded.wasm'
    ];
    
    const baseUrl = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@latest/dist/';
    const results = { success: [], failed: [] };
    
    console.log('Preloading WASM files...');
    
    for (const file of wasmFiles) {
        try {
            const url = baseUrl + file;
            console.log(`Attempting to preload: ${url}`);
            
            // Utiliser fetch pour précharger le fichier
            const response = await fetch(url, { method: 'HEAD' });
            
            if (response.ok) {
                console.log(`Preloading successful: ${file}`);
                results.success.push(file);
            } else {
                console.warn(`Preloading failed: ${file} (${response.status})`);
                results.failed.push({ file, status: response.status });
            }
        } catch (error) {
            console.error(`Error preloading ${file}:`, error);
            results.failed.push({ file, error: error.message });
        }
    }
    
    console.log('WASM preloading results:', results);
    return results;
};

// Exécuter le diagnostic et précharger les fichiers WASM au démarrage
checkEnvironment();
preloadWasmFiles().catch(error => {
    console.warn('Error preloading WASM files:', error);
});

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
                        `Invalid dtype "${dtype}" provided, falling back to \"q4\"`,
                    );
                    dtype = "q4";
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
                            `Invalid dtype "${dtype[k]}" for ${k}, using \"q4\"`,
                        );
                        dtype[k] = "q4";
                    }
                }
            } else {
                dtype = {
                    encoder_model: "fp32",
                    decoder_model_merged: "q4",
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
                        "WebGPU failed, falling back to WASM",
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

self.addEventListener('message', async (event) => {
    try {
        const result = await transcribe(event.data);
        
        // Envoyer le résultat final de la transcription
        if (result) {
            self.postMessage({
                status: "complete",
                data: result,
            });
        }
    } catch (error) {
        // Gestion d'erreur améliorée avec diagnostic complet
        const errorDetails = {
            message: error.message || String(error),
            stack: error.stack,
            name: error.name,
            code: error.code || 'unknown',
            type: typeof error,
            isNumber: typeof error === 'number',
            originalError: error
        };
        
        // Ajouter des détails spécifiques si disponibles
        if (error.webgpuError) {
            errorDetails.webgpuError = {
                message: error.webgpuError.message,
                code: error.webgpuError.code
            };
        }
        
        if (error.wasmError) {
            errorDetails.wasmError = {
                message: error.wasmError.message,
                code: error.wasmError.code,
                isNumber: typeof error.wasmError === 'number',
                numericValue: typeof error.wasmError === 'number' ? error.wasmError : null
            };
        }
        
        if (error.environment) {
            errorDetails.environment = error.environment;
        }
        
        console.error('Detailed error in worker:', errorDetails);
        
        // Créer un message d'erreur utilisateur plus informatif
        let userMessage = 'Transcription model initialization error.';
        
        if (typeof error === 'number') {
            userMessage += ` Numeric error code: ${error}`;
        } else if (error.message) {
            userMessage += ` ${error.message}`;
        }
        
        // Ajouter des suggestions basées sur le type d'erreur
        if (errorDetails.wasmError?.isNumber) {
            userMessage += '\n\nSuggestions:\n- Check your internet connection\n- Try reloading the page\n- Use a more recent browser';
        }
        
        // Envoyer l'erreur à l'interface utilisateur
        self.postMessage({
            type: 'error',
            message: userMessage,
            details: errorDetails
        });
    }
});

class AutomaticSpeechRecognitionPipelineFactory {
    static task = "automatic-speech-recognition";
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
            let webgpuError = null;
            let wasmError = null;
            
            // Diagnostic de l'environnement avant initialisation
            const env = checkEnvironment();
            
            try {
                // Tentative avec WebGPU d'abord si disponible
                if (this.gpu && env.webgpu) {
                    console.log('Attempting initialization with WebGPU...');
                    this.instance = await pipeline(this.task, this.model, {
                        dtype: this.dtype,
                        device: 'webgpu',
                        progress_callback,
                    });
                    console.log('WebGPU initialized successfully');
                    return this.instance;
                } else {
                    webgpuError = new Error('WebGPU not available or disabled');
                    throw webgpuError;
                }
            } catch (error) {
                webgpuError = error;
                console.warn('WebGPU failed:', {
                    message: error.message,
                    code: error.code,
                    name: error.name,
                    stack: error.stack
                });
            }
            
            // Tentatives de fallback WASM avec différentes configurations
            // Note: Seule la première tentative affiche la progression pour éviter les doublons d'affichage
            const wasmConfigs = [
                {
                    name: 'standard WASM',
                    config: {
                        dtype: this.dtype,
                        device: 'wasm',
                        progress_callback, // Affichage de la progression pour la première tentative
                    }
                },
                {
                    name: 'WASM without SIMD',
                    config: {
                        dtype: this.dtype,
                        device: 'wasm',
                        progress_callback: null, // Pas d'affichage pour les fallbacks
                        execution_providers: ['wasm']
                    }
                },
                {
                    name: 'WASM with simplified dtype',
                    config: {
                        dtype: 'q8',
                        device: 'wasm',
                        progress_callback: null, // Pas d'affichage pour les fallbacks
                    }
                },
                {
                    name: 'WASM with very simplified dtype',
                    config: {
                        dtype: 'q4',
                        device: 'wasm',
                        progress_callback: null, // Pas d'affichage pour les fallbacks
                    }
                }
            ];
            
            for (const { name, config } of wasmConfigs) {
                try {
                    console.log(`Attempting initialization: ${name}`);
                    this.instance = await pipeline(this.task, this.model, config);
                    console.log(`${name} initialized successfully`);
                    return this.instance;
                } catch (error) {
                    wasmError = error;
                    console.warn(`${name} failed:`, {
                        message: error.message,
                        code: error.code,
                        name: error.name,
                        errorNumber: typeof error === 'number' ? error : 'N/A'
                    });
                }
            }
            
            // Si toutes les tentatives échouent
            const detailedError = new Error(
                `Complete initialization failure:\n` +
                `- WebGPU: ${webgpuError?.message || 'Not tested'}\n` +
                `- WASM: ${wasmError?.message || 'All configurations failed'}\n` +
                `- WASM error code: ${typeof wasmError === 'number' ? wasmError : wasmError?.code || 'Unknown'}\n` +
                `- Environment: WebGPU=${env.webgpu}, WASM=${env.wasm}, SIMD=${env.simd}, Threads=${env.threads}`
            );
            
            detailedError.webgpuError = webgpuError;
            detailedError.wasmError = wasmError;
            detailedError.environment = env;
            
            throw detailedError;
        }
        return this.instance;
    }
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
    const stride_length_s = 0;

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

    // Check if this is an English-only model
    const isEnglishOnly = model.includes('.en');
    
    // Options for the transcription call
    const params = {
        // Greedy
        top_k: 0,
        do_sample: false,

        // Sliding window
        chunk_length_s,
        stride_length_s,

        // Return timestamps
        return_timestamps: true,
        force_full_sequences: false,

        // Callback functions
        streamer, // after each generation step
    };
    
    // Only add language and task for multilingual models
    if (!isEnglishOnly) {
        params.language = language;
        params.task = subtask;
    }

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
                const cpuTranscriber = await p.getInstance(null); // Pas de progress_callback pour le fallback
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

    // Perform speaker diarization on the final chunks
    let finalChunks = chunks;
    let speakerSegments = [];
    
    try {
        const diarizationResult = await performSpeakerDiarization(audio, chunks);
        finalChunks = diarizationResult.chunks;
        speakerSegments = diarizationResult.speakerSegments;
        
        // Send final update with speaker information
        self.postMessage({
            status: "complete",
            data: {
                text: finalChunks.map(chunk => chunk.text).join("").trim(),
                chunks: finalChunks,
                tps,
                speakerSegments,
            },
        });
    } catch (error) {
        console.warn('Speaker diarization failed, proceeding without it:', error);
        // Send final update without speaker information
        self.postMessage({
            status: "complete",
            data: {
                text: finalChunks.map(chunk => chunk.text).join("").trim(),
                chunks: finalChunks,
                tps,
                speakerSegments: [],
            },
        });
    }

    return {
        tps,
        chunks: finalChunks,
        speakerSegments,
        ...output,
    };
};
