#!/usr/bin/env python3
import sys
import os
import json
import logging
import asyncio
import threading
from dotenv import load_dotenv
from deepgram import (
    DeepgramClient,
    DeepgramClientOptions,
    LiveTranscriptionEvents,
    LiveOptions,
    Microphone,
)

# Load environment variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger("AiboVoiceService")

# Get API Key
API_KEY = os.getenv("DEEPGRAM_API_KEY")
if not API_KEY or "YOUR_DEEPGRAM_API_KEY" in API_KEY:
    logger.error("DEEPGRAM_API_KEY not found in .env file!")
    sys.exit(1)

# Global control for pause/resume
is_paused = False

def input_thread():
    """Listen for pause/resume commands from the Node.js bridge."""
    global is_paused
    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                break
            cmd = line.strip().lower()
            if cmd == "pause":
                is_paused = True
                logger.debug("Service PAUSED")
            elif cmd == "resume":
                is_paused = False
                logger.debug("Service RESUMED")
        except EOFError:
            break

def heartbeat_thread():
    """Send periodic heartbeat to Node.js to signal health."""
    while True:
        try:
            print(json.dumps({"type": "heartbeat", "status": "alive"}), flush=True)
        except:
            pass
        import time
        time.sleep(10)

async def main():
    global is_paused
    
    # Start sidecars
    threading.Thread(target=input_thread, daemon=True).start()
    threading.Thread(target=heartbeat_thread, daemon=True).start()

    try:
        # 1. Initialize Deepgram Client
        logger.info("Initializing Deepgram...")
        config = DeepgramClientOptions(options={"keepalive": "true"})
        deepgram = DeepgramClient(API_KEY, config)

        # 2. Setup WebSocket Connection
        dg_connection = deepgram.listen.live.v("1")

        def on_open(self, *args, **kwargs):
            logger.info("Deepgram Connection Open!")
            result = {"type": "status", "status": "ready"}
            print(json.dumps(result), flush=True)

        def on_message(self, result, *args, **kwargs):
            if is_paused: return
            sentence = result.channel.alternatives[0].transcript if result.channel else ""
            if not sentence: return
            logger.info(f"Transcript: {sentence}")
            print(json.dumps({"type": "transcript", "text": sentence, "is_final": result.is_final}), flush=True)

        def on_metadata(self, metadata, *args, **kwargs):
            logger.info(f"Metadata: {metadata}")

        def on_error(self, error, *args, **kwargs):
            logger.error(f"Deepgram Error: {error}")

        def on_close(self, close, *args, **kwargs):
            logger.info(f"Deepgram Closed: {close}")

        # Register Events
        dg_connection.on(LiveTranscriptionEvents.Open, on_open)
        dg_connection.on(LiveTranscriptionEvents.Transcript, on_message)
        dg_connection.on(LiveTranscriptionEvents.Metadata, on_metadata)
        dg_connection.on(LiveTranscriptionEvents.Error, on_error)
        dg_connection.on(LiveTranscriptionEvents.Close, on_close)

        # 3. Configure Live Options
        options = LiveOptions(
            model="nova-2",
            language="en-US",
            smart_format=True,
            interim_results=True,
            endpointing="true", 
        )

        # 4. Start Connection
        logger.info("Starting connection...")
        dg_connection.start(options)

        # 5. Wait for ready (optional, but good for stability)
        # We could wait for the status:ready signal from on_open, 
        # but dg_connection.start() is blocking so it should be open now.
        await asyncio.sleep(2) # Give it 2 seconds to be double sure

        # 6. Start Microphone
        logger.info("Starting microphone...")
        try:
            microphone = Microphone(dg_connection.send)
            microphone.start()
            logger.info("Microphone started successfully!")
        except Exception as mic_err:
            logger.error(f"Failed to start microphone: {mic_err}")
            raise

        # Keep alive
        while True:
            await asyncio.sleep(1)

    except Exception as e:
        logger.error(f"Could not start Deepgram service: {e}")
        import traceback
        logger.error(traceback.format_exc())
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
