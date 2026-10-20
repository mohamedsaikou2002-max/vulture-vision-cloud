#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
app_root="$PWD"
whisper_root="${WHISPER_CHECKOUT:-/workspace/whisper.cpp}"
if [ ! -d "$whisper_root/.git" ]; then git clone https://github.com/ggml-org/whisper.cpp.git "$whisper_root"; fi
git -C "$whisper_root" checkout "$(cat deployment/whisper/UPSTREAM_REF)"
news-crawler/.venv/bin/pip install -r services/voice/requirements.txt cmake==3.31.6
news-crawler/.venv/bin/cmake -S "$whisper_root" -B "$whisper_root/build" -DWHISPER_BUILD_SERVER=ON -DWHISPER_BUILD_TESTS=OFF -DGGML_NATIVE=OFF -DCMAKE_BUILD_TYPE=Release
news-crawler/.venv/bin/cmake --build "$whisper_root/build" --target whisper-server whisper-cli -j 4
bash "$whisper_root/models/download-ggml-model.sh" tiny.en "$whisper_root/models"
