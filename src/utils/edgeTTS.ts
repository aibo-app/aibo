/**
 * Edge TTS client that calls our server endpoint
 * Server uses edge-tts library which is completely free!
 */
import { API_BASE } from '../lib/api';

interface EdgeTTSOptions {
    voice?: string;
    rate?: string;
    pitch?: string;
}

export class EdgeTTS {
    /**
     * Generate speech from text using Edge TTS via server
     */
    static async synthesize(text: string, options: EdgeTTSOptions = {}): Promise<ArrayBuffer> {
        const {
            voice = 'en-US-AnaNeural',
        } = options;

        // Call our server endpoint which handles Edge TTS
        const response = await fetch(`${API_BASE}/api/tts/speak`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text, voice })
        });

        if (!response.ok) {
            throw new Error(`TTS request failed: ${response.status}`);
        }

        return await response.arrayBuffer();
    }

    /**
     * Get cute voice options for Aibo
     */
    static getCuteVoices(): string[] {
        return [
            'en-US-JennyNeural',      // Warm, friendly female (default)
            'en-US-AnaNeural',        // Young girl - cute
            'en-GB-MiaNeural',        // British child
            'en-AU-NatashaNeural',    // Australian female (friendly)
            'en-US-AriaNeural',       // Expressive female
            'en-US-GuyNeural',        // Male - news style
            'en-GB-RyanNeural',       // British male
            'en-US-SaraNeural',       // Soft female
            'en-US-EmmaNeural',       // Young female
            'en-GB-SoniaNeural',      // British female
            'en-AU-AnnetteNeural',    // Australian female
            'en-CA-ClaraNeural',      // Canadian female
            'en-IE-EmilyNeural',      // Irish female
            'en-IN-NeerjaNeural',     // Indian female
            'en-US-DavisNeural',      // Male - expressive
            'en-US-TonyNeural',       // Male - friendly
        ];
    }
}
