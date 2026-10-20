# Speech and continuous news backend

The app integrates the official ggml-org/whisper.cpp source at the revision in
`UPSTREAM_REF`. The upstream checkout stays outside this repository. MIT notice
is retained. No model or native binary is shipped in the frontend.

Run `deployment/whisper/setup.sh` from the app checkout to clone, pin, build and
download the tiny English model. Set `WHISPER_CHECKOUT` for another directory.
A multilingual production installation can supply a different compatible model.

For local smoke testing start the engine on a separate port from Vite:

```
/workspace/whisper.cpp/build/bin/whisper-server --host 127.0.0.1 --port 8081 -m /workspace/whisper.cpp/models/ggml-tiny.en.bin --no-gpu -t 4
WHISPER_URL=http://127.0.0.1:8081 news-crawler/.venv/bin/uvicorn services.voice.app:app --host 127.0.0.1 --port 8090
```

Set the gateway's `SUPABASE_URL`, `SUPABASE_ANON_KEY` and exact
`VOICE_ALLOWED_ORIGINS`. The gateway verifies each bearer session with Supabase,
accepts only mono 16 kHz PCM WAV of 0.5–30 seconds, limits parallel inference,
and never persists recordings. Place it behind HTTPS with ingress request/body
limits and per-member rate limits. Never expose whisper.cpp's inference/load
server directly to the public Internet.

Set frontend `VITE_VOICE_HOST` to the HTTPS gateway origin before building.
Without this setting, the app explicitly uses browser speech recognition.
The mic starts only on user interaction. Hands-free mode resumes listening after
a run and spoken response finish; transcripts have a visible cancel countdown.
Whisper confidence is unknown; it is not shown as a measured accuracy score.

`deployment/compose.yaml` defines restartable news, private Whisper and voice
services. Set its required variables through the host's secret manager. Set
`WHISPER_MODEL_DIR` to the directory containing the downloaded model. Configure
an HTTPS reverse proxy to the gateway's loopback port 8090. Build and start with
`docker compose -f deployment/compose.yaml up -d --build` on your deployment host.
The Docker path is supplied for deployment; only the native build and Python
service tests were executable in the cloud task.

News runs all 207 additional sources plus the existing enabled registry. It
collects metadata/source links only, honors robots and access failures, and
never bypasses publisher restrictions. It writes dated articles and source
heartbeats using the service credential. Apply the additive source-status
migration through the existing release process; credentials remain server-side.
The feed polls every minute, can receive realtime inserts if the project enables
them, and pages through the index. The simulator displays recent indexed news
and preserves selected source IDs in scenario requests. No news item starts a
paid simulation automatically.
