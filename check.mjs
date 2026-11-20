// Run one small functional check against CSC Aitta. See README.md for the cases.
const root = "https://aitta-api.csc.fi";
const e5 = "intfloat/multilingual-e5-large";
const whisper = "openai/whisper-large-v3";

async function request(path, options = {}, timeout = 30_000) {
  const headers = new Headers(options.headers);
  if (path !== "/openapi.json") {
    const token = process.env.AITTA_API_TOKEN;
    if (!token) throw new Error("Set AITTA_API_TOKEN to your own Aitta token.");
    headers.set("Authorization", "Bearer " + token);
  }
  return fetch(root + path, {
    ...options, headers, redirect: "error", signal: AbortSignal.timeout(timeout),
  });
}

async function embeddings() {
  const input = "query: What is the invoice total?";
  for (const [label, text, encoding] of [
    ["float control", input, "float"],
    ["base64 requested", input, "base64"],
    ["510 words", Array(510).fill("a").join(" "), "float"],
    ["511 words", Array(511).fill("a").join(" "), "float"],
  ]) {
    const res = await request("/openai/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: e5, input: text, encoding_format: encoding }),
    });
    const raw = await res.text();
    const data = res.ok ? JSON.parse(raw) : null;
    const vector = data?.data?.[0]?.embedding;
    console.log(label, {
      http: res.status, tokens: data?.usage?.prompt_tokens,
      representation: Array.isArray(vector) ? "array of " + typeof vector[0] : typeof vector,
      length: vector?.length,
      ...(res.ok ? {} : { errorMentionsLength: /512|length|too long|token/i.test(raw) }),
    });
    if ([401, 403, 429].includes(res.status)) break;
  }
}

async function transcribe(model, format, units = [], timeout = 30_000) {
  const form = new FormData();
  form.set("model", model);
  form.set("file", Bun.file(new URL("./notebooks.wav", import.meta.url)), "notebooks.wav");
  form.set("language", "en");
  form.set("response_format", format);
  for (const unit of units) form.append("timestamp_granularities[]", unit);
  const start = performance.now();
  const res = await request("/openai/v1/audio/transcriptions", { method: "POST", body: form }, timeout);
  const raw = await res.text();
  const mime = res.headers.get("content-type")?.split(";")[0];
  const data = res.ok && mime === "application/json" ? JSON.parse(raw) : null;
  console.log(model, format, units, {
    http: res.status, mime, seconds: (performance.now() - start) / 1000,
    transcript: data?.text ?? (res.ok && mime === "text/plain" ? raw.trim() : undefined),
    segments: data?.segments?.length, words: data?.words?.length,
    nestedWords: data?.segments?.reduce((n, segment) => n + (segment.words?.length ?? 0), 0),
  });
  return res.ok;
}

async function showWorkers(model) {
  const res = await request("/worker/" + model.replaceAll("/", "~"));
  const data = res.ok ? await res.json() : null;
  console.log("workers", res.status, data?._embedded?.workers?.map(worker => worker.status));
}

async function turbo() {
  const model = whisper + "-turbo";
  await showWorkers(model);
  try {
    await transcribe(model, "json", [], 80_000);
  } finally {
    await showWorkers(model);
  }
}

async function spec() {
  const res = await request("/openapi.json");
  if (!res.ok) throw new Error("OpenAPI returned HTTP " + res.status);
  const spec = await res.json();
  const op = spec.paths["/openai/v1/audio/transcriptions"].post;
  console.log({
    encodings: spec.components.schemas.OpenAIEmbeddingsRequest.properties.encoding_format.enum,
    timestamps: spec.components.schemas.TranscriptionFormData.properties["timestamp_granularities[]"].items.enum,
    uploadTypes: Object.keys(op.requestBody.content),
    successTypes: Object.keys(op.responses["200"].content),
  });
}

try {
  console.log("Started (UTC)", new Date().toISOString());
  switch (process.argv[2]) {
    case "e5": await embeddings(); break;
    case "whisper":
      if (await transcribe(whisper, "text")) {
        await transcribe(whisper, "verbose_json", ["word"]);
      }
      break;
    case "turbo": await turbo(); break;
    case "spec": await spec(); break;
    default: throw new Error("Usage: bun check.mjs <e5|whisper|turbo|spec>");
  }
} catch (error) {
  console.error(error.name + ": " + error.message);
  process.exitCode = 1;
}
