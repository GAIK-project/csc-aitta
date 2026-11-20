# CSC Aitta API findings

On 20 November 2026, I tested the Aitta API for the GAIK project using short text inputs and a synthetic English recording. The examples below show the requests and responses so CSC can reproduce the findings.

## Reproducible findings

| Model or endpoint | What I tested | What I observed |
| --- | --- | --- |
| `intfloat/multilingual-e5-large` | Sent the same text with `encoding_format="float"` and then `"base64"`. The OpenAPI specification lists both values. | Both requests returned HTTP 200 and a JSON array of 1,024 numbers. A client requesting base64 receives an array where it expects a string. |
| `intfloat/multilingual-e5-large` | Sent 510 copies of `a` separated by spaces, then 511. | The first request returned HTTP 200 and reported 512 tokens. Adding one more `a` produced HTTP 500 with no mention of the length limit. A validation error stating the maximum input length would help callers correct the request. |
| `openai/whisper-large-v3` | Sent a six-second WAV file with `response_format=verbose_json` and `timestamp_granularities[]=word`. | The API returned HTTP 200, an accurate transcript and one timestamped segment. Word timestamps were missing both at the top level and inside the segment. |
| Transcription OpenAPI specification | Compared the declared media types with a successful file upload and plain-text response. | The specification lists only `application/x-www-form-urlencoded` for requests. Both the endpoint description and the working WAV upload use `multipart/form-data`. The specification lists only `application/json` for a successful response, but `response_format=text` returned `text/plain`. |

**Whisper turbo availability.** Whisper large v3 transcribed the same WAV file in about one second. Both turbo requests reached the client's 80-second timeout without a transcript. After the first attempt, the worker endpoint listed `failed` and `requested`. On the second attempt, it listed both states before and after the request. The cause of the delay remains unknown.

## Run the checks

Run these commands from the repository root with Bun (tested with version 1.4.2). The checks use no external packages. The `spec` check reads the public OpenAPI specification. For the other checks, set the `AITTA_API_TOKEN` environment variable to your own Aitta token.

```sh
bun check.mjs spec
bun check.mjs e5
bun check.mjs whisper
bun check.mjs turbo
```

`e5` sends four requests to `POST /openai/v1/embeddings`. The speech checks upload the [sample recording](notebooks.wav) to `POST /openai/v1/audio/transcriptions`. The `turbo` check also reads the worker status before and after the transcription attempt. Each check prints what the API returned for that run.

## Other observations from 20 November 2026

- **Document search in the demo.** Indexing one page took about 76 seconds on the first run and one second on the repeat run. The demo showed e5 as running at the start of the repeat. Once the page was indexed, the demo answered the question with a source citation in 4–5 seconds.
- **gpt-oss 120B and Gemma 4 31B.** In the demo, gpt-oss classified the sample invoice in about 4 seconds and Gemma classified it in about 18 seconds. In a separate task, gpt-oss correctly judged `EUR 60` and `60 euros` to be equivalent. The first evaluation took 54 seconds and the last took 2.3 seconds. These timings come from individual requests. The tests did not measure concurrent user load.
- **Direct model requests.** Gemma correctly read invoice number `4827` from a PNG image in about five seconds. gpt-oss returned HTTP 400 with `reasoning_effort=none`. With `low`, it returned HTTP 200 and included reasoning in the response.

Aitta's API and usage limits are documented in the [OpenAPI specification](https://aitta-api.csc.fi/openapi.json) and the [LUMI user guide](https://docs.lumi-supercomputer.eu/laif/inference/aitta/).
