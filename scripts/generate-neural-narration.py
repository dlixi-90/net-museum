"""Generate bundled Vietnamese narration locally; no paid API is used."""
import argparse
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import re
import time

os.environ.setdefault("OMP_NUM_THREADS", "4")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "4")

import numpy as np
from vieneu import Vieneu

parser = argparse.ArgumentParser()
parser.add_argument("--samples", type=Path, default=Path("/samples"))
parser.add_argument("--voice", default="Minh Đức")
parser.add_argument("--precision", choices=["fp32", "int8"], default="fp32")
parser.add_argument("--threads", type=int, default=4)
args = parser.parse_args()
samples = args.samples.resolve()
profile_file = samples / "narration-profile.json"
profile = json.loads(profile_file.read_text("utf-8")) if profile_file.exists() else {"items": {}}
engine = "VieNeu-TTS v3 Turbo"
version = importlib.metadata.version("vieneu")

def digest(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()

def save_profile():
    temporary = profile_file.with_suffix(".tmp")
    temporary.write_text(json.dumps(profile, ensure_ascii=False, indent=2) + "\n", "utf-8")
    temporary.replace(profile_file)

print(f"Loading {engine}, {args.precision}, voice {args.voice}…", flush=True)
tts = Vieneu(precision=args.precision, threads=args.threads)
if args.voice not in {name for _, name in tts.list_preset_voices()}:
    raise RuntimeError("Requested preset voice is unavailable; refusing a fallback voice.")
profile.update({"engine": engine, "sdkVersion": version, "voice": args.voice,
                "language": "vi-VN", "precision": args.precision, "sampleRate": tts.sample_rate,
                "model": "pnnbao-ump/VieNeu-TTS-v3-Turbo", "license": "Apache-2.0"})
inputs = sorted(p for p in samples.glob("*-transcript.txt") if re.fullmatch(r"\d+-transcript\.txt", p.name))
if not inputs:
    raise RuntimeError("No narration transcripts found. Run --prepare first.")

for source in inputs:
    artifact_id = source.name.removesuffix("-transcript.txt")
    target = samples / f"{artifact_id}-audio.wav"
    input_hash = digest(source)
    existing = profile["items"].get(artifact_id, {})
    if (target.exists() and existing.get("inputSha256") == input_hash
            and existing.get("voice") == args.voice and existing.get("precision") == args.precision
            and existing.get("sdkVersion") == version and existing.get("wavSha256") == digest(target)):
        print(f"Keeping completed narration {artifact_id}", flush=True)
        continue
    started = time.time()
    text = source.read_text("utf-8").strip()
    np.random.seed(42)
    audio = tts.infer(text, voice=args.voice, temperature=0.8, max_chars=180)
    duration = len(audio) / tts.sample_rate
    if (not np.isfinite(audio).all() or not 10 < duration < 180
            or float(np.sqrt(np.mean(audio ** 2))) < 0.003):
        raise RuntimeError(f"Invalid or silent narration for {artifact_id}")
    temporary = target.with_name(f"{artifact_id}-audio.tmp.wav")
    tts.save(audio, str(temporary))
    temporary.replace(target)
    profile["items"][artifact_id] = {"voice": args.voice, "precision": args.precision,
        "sdkVersion": version, "inputSha256": input_hash, "wavSha256": digest(target),
        "duration": round(duration, 3)}
    save_profile()
    print(f"Generated {artifact_id}: {duration:.1f}s of speech in {time.time() - started:.1f}s", flush=True)

save_profile()
print(f"Completed {len(inputs)} Vietnamese narrations with {args.voice}.", flush=True)
