// WhisperTextStreamer for handling streaming text output from Whisper model
export class WhisperTextStreamer {
    constructor(tokenizer, skip_prompt = true, decode_kwargs = {}) {
        this.tokenizer = tokenizer;
        this.skip_prompt = skip_prompt;
        this.decode_kwargs = decode_kwargs;
        this.token_cache = [];
        this.print_len = 0;
        this.next_tokens_are_prompt = true;
    }

    put(value) {
        if (this.skip_prompt && this.next_tokens_are_prompt) {
            this.next_tokens_are_prompt = false;
            return;
        }

        // Filter out timestamp tokens (typically >= 50257 for Whisper models)
        // and other special tokens that shouldn't be decoded
        const filtered_tokens = value.filter(token => {
            // Skip timestamp tokens and other special tokens
            return typeof token === 'number' && token < 50257 && token >= 0;
        });
        
        if (filtered_tokens.length > 0) {
            this.token_cache.push(...filtered_tokens);
        }
        
        // Skip decoding if token_cache is empty
        if (this.token_cache.length === 0) {
            return;
        }
        
        const text = this.tokenizer.decode(this.token_cache, this.decode_kwargs);
        
        if (text.endsWith('\n')) {
            const printable_text = text.slice(this.print_len);
            this.token_cache = [];
            this.print_len = 0;
            
            if (this.on_finalized_text) {
                this.on_finalized_text(printable_text, false);
            }
        } else if (text.length > this.print_len) {
            const printable_text = text.slice(this.print_len);
            this.print_len = text.length;
            
            if (this.on_partial_text) {
                this.on_partial_text(printable_text);
            }
        }
    }

    end() {
        if (this.token_cache.length > 0) {
            const text = this.tokenizer.decode(this.token_cache, this.decode_kwargs);
            const printable_text = text.slice(this.print_len);
            this.token_cache = [];
            this.print_len = 0;
            
            if (this.on_finalized_text) {
                this.on_finalized_text(printable_text, true);
            }
        }
    }

    // Callback methods to be overridden
    on_partial_text(text) {
        // Override this method to handle partial text
    }

    on_finalized_text(text, is_final) {
        // Override this method to handle finalized text
    }
}