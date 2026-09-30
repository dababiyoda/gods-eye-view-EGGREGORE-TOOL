# Local open-source AI

The AI default is local; an existing OpenAI key never enables paid HUD or realtime.
Install Ollama, start its server with OLLAMA_NO_CLOUD=1, and pull qwen3.5:4b.
Set these in the application's .env:

    LLM_PROVIDER=ollama
    LLM_BASE_URL=http://127.0.0.1:11434/v1
    LLM_MODEL=qwen3.5:4b

HUD summaries use the loopback OpenAI-compatible chat endpoint, with no paid
fallback. Setting LLM_PROVIDER=template or omitting the local URL preserves the
existing keyless HUD. Local failures remain visible instead of contacting a hosted
provider. Existing paid OpenAI integrations remain in history/source and require
explicit LLM_PROVIDER=openai to run.

This is a HUD migration, not speech parity. The current microphone controls use
OpenAI's realtime token + WebRTC SDP protocol. Changing the model name or base URL
cannot make Ollama implement it. Default local mode refuses that paid token route;
manual globe controls and keyless/public-data layers remain available.

A complete free voice path needs faster-whisper for speech recognition, local
Qwen tool calls dispatched through the existing GEV action validation, and Kokoro
speech synthesis. These projects were researched but their services, microphone
capture, audio queue and interruption handling have not been installed. No local
voice availability is claimed. Model weights/voices need independent license checks.

See the UNIIMENTE Kernel docs/OPEN_SOURCE_STACK.md candidate and dated repository
snapshot for exact GitHub sources, stars, license review and the project-wide
reuse map. Google photorealistic tiles and platform/data quotas do not become free
when a local model is installed. Continue using existing keyless imagery/terrain
where appropriate; no paid geographic-data parity is claimed.

Review notes (one assistant, not independent review): builder reuses the /v1
protocol; adversary checks legacy-key billing and redirects; operator keeps local
voice gaps visible; beneficiary retains local prompt handling and manual controls;
constitutional reviewer preserves action validation. Pass 1 replaces only HUD
generation and gates paid voice explicitly. Pass 2 tests hidden billing via legacy
keys, malformed local URLs, and failed-model fallback.

Attach by configuring the loopback model; detach with LLM_PROVIDER=template and
preserve current data. This development change starts no model service, activates
no external authority, and incurs no paid calls. Mock tests prove protocol/routing
behavior, not model accuracy, speech capability or deployment.
