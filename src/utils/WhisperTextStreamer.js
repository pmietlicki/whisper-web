// WhisperTextStreamer for handling streaming text output from Whisper model
export class WhisperTextStreamer {
    constructor(tokenizer, options = {}) {
        this.tokenizer = tokenizer;
        this.skip_prompt = options.skip_prompt ?? true;
        this.decode_kwargs = options.decode_kwargs || {};
        this.time_precision = options.time_precision || 0.02;
        
        // Custom callbacks from worker
        this.on_chunk_start = options.on_chunk_start;
        this.on_chunk_end = options.on_chunk_end;
        this.callback_function = options.callback_function;
        this.token_callback_function = options.token_callback_function;
        this.on_finalize = options.on_finalize;
        
        // Internal state
        this.token_cache = [];
        this.print_len = 0;
        this.next_tokens_are_prompt = true;
        this.current_tokens = [];
        this.chunk_started = false;
        
        console.log('WhisperTextStreamer initialized with callbacks:', {
            on_chunk_start: !!this.on_chunk_start,
            on_chunk_end: !!this.on_chunk_end,
            callback_function: !!this.callback_function,
            token_callback_function: !!this.token_callback_function
        });
    }

    put(value) {
        console.log('WhisperTextStreamer.put called with tokens:', value, 'Token values:', value.map(t => `${t} (${typeof t})`));
        
        if (this.skip_prompt && this.next_tokens_are_prompt) {
            console.log('Skipping prompt tokens');
            this.next_tokens_are_prompt = false;
            return;
        }

        // Handle timestamp tokens for chunk boundaries
        // Convert tokens to numbers if they're objects with valueOf method
        const normalizeToken = (token) => {
            if (typeof token === 'number') return token;
            if (typeof token === 'object' && token !== null && typeof token.valueOf === 'function') {
                return Number(token.valueOf());
            }
            return Number(token);
        };
        
        const normalizedTokens = value.map(normalizeToken).filter(token => !isNaN(token));
        console.log('Normalized tokens:', normalizedTokens);
        
        const timestamp_tokens = normalizedTokens.filter(token => token >= 50257);
        const text_tokens = normalizedTokens.filter(token => token < 50257 && token >= 0);
        
        console.log('Filtered tokens - timestamp:', timestamp_tokens, 'text:', text_tokens);
        
        // Process timestamp tokens for chunk start/end
        if (timestamp_tokens.length > 0) {
            for (const token of timestamp_tokens) {
                const time = (token - 50257) * this.time_precision;
                
                if (!this.chunk_started && this.on_chunk_start) {
                    console.log('Chunk start at time:', time);
                    this.on_chunk_start(time);
                    this.chunk_started = true;
                } else if (this.chunk_started && this.on_chunk_end) {
                    console.log('Chunk end at time:', time);
                    this.on_chunk_end(time);
                    this.chunk_started = false;
                    
                    // Finalize current chunk
                    if (this.on_finalize) {
                        this.on_finalize();
                    }
                }
            }
        }
        
        // Process text tokens
        if (text_tokens.length > 0) {
            console.log('Adding text tokens to cache:', text_tokens);
            this.current_tokens.push(...text_tokens);
            console.log('Current token cache:', this.current_tokens);
            
            // Call token callback for each token
            if (this.token_callback_function) {
                for (const token of text_tokens) {
                    this.token_callback_function(token);
                }
            }
            
            // Decode and send partial text
            try {
                const decoded_text = this.tokenizer.decode(this.current_tokens, this.decode_kwargs);
                console.log('Decoded text:', decoded_text, 'Print len:', this.print_len);
                const new_text = decoded_text.slice(this.print_len);
                console.log('New text to send:', new_text);
                
                if (new_text && this.callback_function) {
                    console.log('Calling callback_function with:', new_text);
                    this.callback_function(new_text);
                    this.print_len = decoded_text.length;
                } else {
                    console.log('Not calling callback - new_text:', !!new_text, 'callback_function:', !!this.callback_function);
                }
            } catch (error) {
                console.warn('Error decoding tokens:', error);
            }
        } else {
            console.log('No text tokens to process');
        }
    }

    end() {
        console.log('WhisperTextStreamer.end called');
        
        if (this.chunk_started && this.on_chunk_end) {
            // End the current chunk
            this.on_chunk_end(0);
        }
        
        if (this.on_finalize) {
            this.on_finalize();
        }
        
        // Reset state
        this.current_tokens = [];
        this.print_len = 0;
        this.chunk_started = false;
    }

    // Legacy callback methods for compatibility
    on_partial_text(text) {
        if (this.callback_function) {
            this.callback_function(text);
        }
    }

    on_finalized_text(text, is_final) {
        if (this.callback_function) {
            this.callback_function(text);
        }
    }
}