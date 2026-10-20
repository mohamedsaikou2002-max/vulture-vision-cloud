FROM debian:bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends git cmake g++ ca-certificates && rm -rf /var/lib/apt/lists/*
ARG WHISPER_REF=231638a0717b7822784297e5980965ffcec05810
RUN git clone https://github.com/ggml-org/whisper.cpp.git /whisper && git -C /whisper checkout "$WHISPER_REF"
RUN cmake -S /whisper -B /whisper/build -DWHISPER_BUILD_SERVER=ON -DWHISPER_BUILD_TESTS=OFF -DGGML_NATIVE=OFF -DBUILD_SHARED_LIBS=OFF -DCMAKE_BUILD_TYPE=Release && cmake --build /whisper/build --target whisper-server -j 4
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 libstdc++6 ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=build /whisper/build/bin/whisper-server /usr/local/bin/whisper-server
USER 65534:65534
EXPOSE 8081
ENTRYPOINT ["whisper-server","--host","0.0.0.0","--port","8081","-m","/models/ggml-tiny.en.bin","--no-gpu","-t","4"]
