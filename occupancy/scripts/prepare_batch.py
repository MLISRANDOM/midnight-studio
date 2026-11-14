#!/usr/bin/env python3
"""Prepare ComfyUI-BulkPrompt prompts from the approved OCCUPANCY storyboard.
Pure stdlib; no API calls, GPU jobs, credits, or image generations.
"""
import argparse
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CSV = ROOT / "episode01" / "storyboard.csv"
STYLE = (
    "Original OCCUPANCY 2D horror cartoon. Exact approved model sheet appearance; "
    "simplified round expressive white eyes, thick clean black outlines, flat solid colors, "
    "minimal gradients, navy/charcoal midnight palette, localized cool fluorescent blue "
    "and warm flashlight or emergency red, detailed but stylized Graywell apartment architecture. "
    "Single still image, cinematic composition, no split screen, collage, title card, words or lettering."
)
CHARACTERS = {
    "Mara": "Mara Ortiz: medium-brown skin, strong eyebrows, long dark braids gathered in HIGH BUN with loose front braids, silver hoop earrings, navy MAINTENANCE jacket with crossed-tools patch, dark shirt, gray cargo pants, brown work boots, olive backpack, utility tools. NOT a medic.",
    "Jonah": "Jonah Pike: older light-skinned man, full gray beard, brown baseball cap, olive work jacket, tan shirt, blue jeans, brown boots, keys and flashlight.",
    "Leah": "Leah Okafor: dark-skinned Black female paramedic, long neat braids pulled into LOW ponytail, navy PARAMEDIC uniform with medical-star patch, dark pants and black boots, crossbody medical kit. NO high bun and NO crossed-tools patch.",
}
NEGATIVE = (
    "Evan, male bearded hoodie protagonist, duplicate character, indistinguishable women, "
    "photorealism, 3d render, anime, manga, gritty hyperreal comic, detailed skin texture, "
    "gibberish text, typography, watermark, subtitles, captions, logo, multiple panels, "
    "different outfit, mutated face, extra limbs, random doors, gore"
)

def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--storyboard", type=Path, default=DEFAULT_CSV)
    p.add_argument("--out", type=Path, default=ROOT / "output")
    p.add_argument("--limit", type=int, default=8, help="First N shots. Use 80 for entire episode.")
    p.add_argument("--width", type=int, default=720)
    p.add_argument("--height", type=int, default=1280)
    return p.parse_args()

def character_names(row):
    text = (row["visual"] + " " + row["continuity"]).lower()
    return [name for name in CHARACTERS if name.lower() in text]

def mode(row):
    i = int(row["index"])
    if i == 1: return "existing_pair"
    if i == 4: return "reuse_after_frame"
    if i == 8: return "edit_black_frame"
    if "hud card" in row["framing"].lower() or "diagram" in row["framing"].lower(): return "graphics_review"
    return "generate"

def main():
    args = parse_args()
    if args.width <= 0 or args.height <= 0 or args.limit < 1:
        raise SystemExit("Invalid dimensions or limit")
    rows = list(csv.DictReader(args.storyboard.open(encoding="utf-8", newline="")))
    if len(rows) != 80: raise SystemExit(f"Expected 80 approved shots, got {len(rows)}")
    required = {"index", "start_seconds", "end_seconds", "framing", "visual", "motion", "continuity"}
    if not required.issubset(rows[0]): raise SystemExit("Unexpected storyboard fields")
    for i, r in enumerate(rows, 1):
        if int(r["index"]) != i or abs(float(r["start_seconds"]) - (i-1)*7.5)>0.001 or abs(float(r["end_seconds"])-i*7.5)>0.001:
            raise SystemExit(f"Shot {i}: invalid time or index")
    args.out.mkdir(parents=True, exist_ok=True)
    all_jobs = []
    csv_jobs = []
    for r in rows[:args.limit]:
        i = int(r["index"])
        names = character_names(r)
        kind = mode(r)
        prompt = (
            f"{STYLE} Scene at Graywell apartments. Camera: {r['framing']}. "
            f"Action and visual: {r['visual']}. Maintain continuity: {r['continuity']}. "
            "All numbers, clock displays, warning symbols, documents and HUD lettering must remain blank "
            "for perfectly readable overlays added in post-production. "
            + " ".join(CHARACTERS[n] for n in names)
        )
        if "doorway should be" in r["visual"] or "smooth plaster" in r["visual"]:
            prompt += " The vanished apartment has absolutely NO doorway outline, seams, damage, recess or glowing portal. Just uninterrupted smooth finished plaster."
        job = {
            "shot": i, "start": float(r["start_seconds"]), "end": float(r["end_seconds"]),
            "mode": kind, "characters": names, "prompt": prompt, "negative": NEGATIVE,
            "filename_tag": f"OCC_E01_{i:03d}", "width": args.width, "height": args.height,
            "reference_files": ["refs/ENSEMBLE_STYLE_APPROVED.png"] + [f"refs/{n.upper()}_APPROVED.png" for n in names],
            "motion_in_edit": r["motion"], "continuity": r["continuity"]
        }
        all_jobs.append(job)
        if kind == "generate":
            csv_jobs.append({"positive": prompt, "negative": NEGATIVE, "filename_tag": job["filename_tag"]})
    with (args.out / "shot_plan.json").open("w", encoding="utf-8") as f:
        json.dump({"episode": "OCCUPANCY S01E01", "dry_run": True, "width": args.width, "height": args.height,
                   "prepared_count": len(all_jobs), "generation_count": len(csv_jobs),
                   "jobs": all_jobs}, f, indent=2, ensure_ascii=False)
    with (args.out / "bulkprompt.csv").open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["positive", "negative", "filename_tag"])
        writer.writeheader()
        writer.writerows(csv_jobs)
    with (args.out / "review_checklist.md").open("w", encoding="utf-8") as f:
        f.write("# OCCUPANCY Episode 1 review checklist\n\n")
        f.write("Every image: correct 2D art style, single standalone shot, no readable AI text, consistent Graywell geography.\n")
        f.write("Mara: high-bun braids, maintenance patch, gray cargo pants. Leah: LOW ponytail braids, medical patch. Jonah: gray beard and cap. NO Evan.\n")
        f.write("Door 604 before/after must use identical camera perspective; after wall must have no seam or portal.\n\n")
        for job in all_jobs:
            f.write(f"- [ ] Shot {job['shot']:03d} ({job['mode']}): character, location, object and typography check\n")
    print(f"DRY RUN ONLY: {len(all_jobs)} storyboard shots planned, {len(csv_jobs)} new images to queue.")
    print("Created shot_plan.json, bulkprompt.csv and review_checklist.md; NO GPU/API generation.")
if __name__ == "__main__":
    main()
