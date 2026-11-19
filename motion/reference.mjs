/* Measure only decoded pictures. Only aggregate technique data crosses into the renderer. */
const MAX_DURATION = 7200;
const MAX_SAMPLES = 1801;
const round = n => Math.round(n * 1000) / 1000;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export function youtubeId(text) {
  if (!text.trim()) return null;
  let url;
  try { url = new URL(text.trim()); } catch { throw Error("Enter a complete YouTube video link."); }
  const hosts = ["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"];
  const parts = url.pathname.split("/").filter(Boolean);
  let id;
  if (["youtu.be", "www.youtu.be"].includes(url.hostname) && parts.length === 1) id = parts[0];
  if (hosts.includes(url.hostname)) {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    if (parts.length === 2 && ["shorts", "embed", "live"].includes(parts[0])) id = parts[1];
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port || !/^[A-Za-z0-9_-]{11}$/.test(id || ""))
    throw Error("Use a YouTube watch, Shorts, live, or youtu.be video link.");
  return id;
}

export function sampleTimes(duration) {
  if (!(duration > 0 && duration <= MAX_DURATION)) throw Error("Choose a video between one frame and two hours long.");
  const count = Math.min(MAX_SAMPLES, Math.max(2, Math.ceil(duration * 4) + 1));
  const end = duration - Math.min(0.025, duration / 4);
  return Array.from({length: count}, (_, i) => i * end / (count - 1));
}

function median(items) {
  const s = [...items].sort((a, b) => a - b);
  const i = Math.floor(s.length / 2);
  return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2;
}

export function frameStats(bytes) {
  const hist = new Float32Array(48);
  let total = 0;
  const pixels = bytes.length / 4;
  for (let i = 0; i < bytes.length; i += 4) {
    total += 0.2126 * bytes[i] + 0.7152 * bytes[i + 1] + 0.0722 * bytes[i + 2];
    for (let c = 0; c < 3; c++) hist[c * 16 + (bytes[i + c] >> 4)]++;
  }
  return {bytes, hist, luminance: total / (pixels * 255)};
}

export function frameChange(a, b) {
  let hist = 0, diff = 0;
  for (let i = 0; i < a.hist.length; i++) hist += Math.abs(a.hist[i] - b.hist[i]);
  for (let i = 0; i < a.bytes.length; i += 4)
    for (let c = 0; c < 3; c++) diff += Math.abs(a.bytes[i + c] - b.bytes[i + c]);
  const pixels = a.bytes.length / 4;
  const delta = diff / (pixels * 3 * 255);
  return {delta, cut: delta > 0.38 || (delta > 0.105 && hist / (6 * pixels) > 0.33)};
}

function awaitMedia(video, event, change, signal) {
  return new Promise((resolve, reject) => {
    const end = (error) => {
      clearTimeout(timer);
      video.removeEventListener(event, done);
      video.removeEventListener("error", failed);
      signal?.removeEventListener("abort", cancel);
      if (error) reject(error); else resolve();
    };
    const done = () => end();
    const failed = () => end(Error("The browser could not decode this video. Try an MP4 export from its creator."));
    const cancel = () => end(new DOMException("Canceled", "AbortError"));
    const timer = setTimeout(() => end(Error("Timed out waiting for a decoded frame. Try the local MP4 from Files.")), 25000);
    video.addEventListener(event, done, {once: true});
    video.addEventListener("error", failed, {once: true});
    signal?.addEventListener("abort", cancel, {once: true});
    if (signal?.aborted) cancel();
    else { try { change(); } catch (e) { end(e); } }
  });
}

export async function analyzeVideo(source, progress, signal) {
  const video = document.createElement("video");
  video.muted = true; video.playsInline = true; video.preload = "auto";
  const objectUrl = typeof source !== "string" ? URL.createObjectURL(source) : null;
  if (!objectUrl) video.crossOrigin = "anonymous";
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 36;
  const ctx = canvas.getContext("2d", {willReadFrequently: true});
  try {
    await awaitMedia(video, "loadeddata", () => { video.src = objectUrl || source; video.load(); }, signal);
    const duration = video.duration;
    const times = sampleTimes(duration);
    const cuts = [];
    let previous, light = 0, motion = 0, comparisons = 0;
    for (let i = 0; i < times.length; i++) {
      const t = times[i];
      signal?.throwIfAborted();
      if (i > 0) await awaitMedia(video, "seeked", () => { video.currentTime = t; }, signal);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = frameStats(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
      light += frame.luminance;
      if (previous) {
        const change = frameChange(previous, frame);
        if (change.cut) cuts.push(round(t));
        else { motion += change.delta; comparisons++; }
      }
      previous = frame;
      if (i % 8 === 0 || i + 1 === times.length) progress?.((i + 1) / times.length);
    }
    const bounds = [0, ...cuts, duration];
    const lengths = bounds.slice(1).map((v, i) => v - bounds[i]);
    return {kind: "sampled-visual-technique-v1", duration_seconds: round(duration), width: video.videoWidth,
      height: video.videoHeight, sample_count: times.length, first_sample: 0, last_sample: round(times.at(-1)),
      sample_interval: round(times[1]), cut_times: cuts, shot_count_estimate: lengths.length,
      median_shot_seconds: round(median(lengths)), average_luminance: round(light / times.length),
      within_shot_change: round(comparisons ? motion / comparisons : 0)};
  } finally {
    video.removeAttribute("src"); video.load();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

export function readReport(raw) {
  if (!raw || !Number.isFinite(raw.duration_seconds) || raw.duration_seconds <= 0 ||
      raw.duration_seconds > MAX_DURATION || !Number.isFinite(raw.median_shot_seconds) ||
      raw.median_shot_seconds <= 0 || raw.median_shot_seconds > raw.duration_seconds + 0.01 ||
      !Number.isInteger(raw.shot_count_estimate) || raw.shot_count_estimate < 1)
    throw Error("Choose a completed Motion Lab or PR #22 analysis.json report.");
  if (raw.kind === "sampled-visual-technique-v1") {
    if (!(Number.isInteger(raw.sample_count) && raw.sample_count >= 2 && raw.sample_count <= MAX_SAMPLES &&
        Number.isFinite(raw.last_sample) && raw.first_sample === 0 && raw.last_sample <= raw.duration_seconds &&
        raw.last_sample >= raw.duration_seconds - 0.05 &&
        [raw.average_luminance, raw.within_shot_change].every(v => Number.isFinite(v) && v >= 0 && v <= 1)))
      throw Error("The reference report has incomplete coverage.");
    return {kind: raw.kind, duration_seconds: raw.duration_seconds, median_shot_seconds: raw.median_shot_seconds,
      shot_count_estimate: raw.shot_count_estimate, sample_count: raw.sample_count, first_sample: 0,
      last_sample: raw.last_sample, average_luminance: raw.average_luminance, within_shot_change: raw.within_shot_change};
  }
  if (raw.kind === "ffmpeg-technique-v1") {
    if (!Number.isInteger(raw.sample_count) || raw.sample_count < 1 || raw.sample_count > 1801 ||
        ![raw.average_luminance,raw.within_shot_change].every(v=>Number.isFinite(v)&&v>=0&&v<=1))
      throw Error("Incomplete full-video measurements.");
    return {kind:raw.kind,duration_seconds:raw.duration_seconds,median_shot_seconds:raw.median_shot_seconds,
      shot_count_estimate:raw.shot_count_estimate,sample_count:raw.sample_count,average_luminance:raw.average_luminance,
      within_shot_change:raw.within_shot_change};
  }
  if (raw.schema_version !== 1 || raw.analysis_type !== "measured_editing_properties_not_semantic_video_understanding" ||
      !Array.isArray(raw.shots) || raw.shots.length !== raw.shot_count_estimate ||
      raw.shots[0]?.start_seconds !== 0 || Math.abs(raw.shots.at(-1)?.end_seconds - raw.duration_seconds) > 0.025)
    throw Error("This report does not cover the full reference.");
  return {kind: "ffmpeg-scene-pass", duration_seconds: raw.duration_seconds, median_shot_seconds: raw.median_shot_seconds,
    shot_count_estimate: raw.shot_count_estimate};
}

export function direction(report) {
  return {beatSeconds: clamp(report?.median_shot_seconds ?? 1.7, 0.85, 2.8),
    light: clamp(report?.average_luminance ?? 0.42, 0.15, 0.85),
    energy: clamp(0.85 + 2.5 * (report?.within_shot_change ?? 0.06), 0.85, 1.45)};
}
