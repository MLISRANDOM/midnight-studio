"""Deterministic storyboards for a ten-minute, 80-shot original horror motion comic.

All shots remain unapproved drafts. This is a reliable story scaffolder, not an
AI screenwriter. Can be replaced by a tested text model later.
"""
import hashlib
import math
import random

ACTS = [
    ("The ordinary shift", "A familiar location slowly feels wrong",
     "Everything seemed routine, until the details stopped agreeing with memory."),
    ("The first warning", "An impossible signal or rule emerges",
     "The warning made no sense, but ignoring it felt even more dangerous."),
    ("The evidence", "The survivor discovers physical proof",
     "There was finally proof of the thing everyone had been trying to explain away."),
    ("The first mistake", "A small decision creates irreversible consequences",
     "One simple mistake changed the rules of the building forever."),
    ("The pursuit", "The danger closes in without revealing its full form",
     "Whatever was following had learned the survivor's route."),
    ("The false exit", "A promising escape route becomes a trap",
     "For a moment the exit looked real. Then the walls moved again."),
    ("The confrontation", "The survivor faces the impossible",
     "Survival meant seeing what had been hiding in plain sight."),
    ("The revelation", "The story resolves its immediate mystery but opens another",
     "By the end, the safest place had become the most dangerous one."),
]
FRAMES = [
    ("wide establishing composition", "the environment is still and unnaturally empty"),
    ("medium framing", "a distant shadow appears where none should be"),
    ("close visual detail", "a small object has moved by itself"),
    ("wide symmetrical shot", "the architecture feels subtly impossible"),
    ("over-the-shoulder view", "the protagonist watches a dark passage"),
    ("low angle static shot", "a doorway reveals nothing but darkness"),
    ("medium side profile", "the protagonist hesitates beside an exit"),
    ("high angle", "the floor pattern forms an unfamiliar shape"),
    ("tight reaction composition", "the protagonist notices a contradiction"),
    ("wide aftermath shot", "a light changes and leaves the room unfamiliar"),
]
PHRASES = [
    "The first sign was easy to dismiss.",
    "The sound seemed to come from the wrong direction.",
    "No one had touched the door, but it had moved.",
    "The building no longer matched its own floor plan.",
    "A second detail contradicted everything from a moment before.",
    "The safest decision was the one that suddenly seemed impossible.",
    "The next step made the silence feel heavier.",
    "There was something waiting beyond what the camera could see.",
    "The survivor recognized the place, but not the way it behaved.",
    "After that, even the ordinary objects became a threat.",
]

def longform_manifest(series, episode):
    count = int(episode.get("shot_count", 80))
    if not 12 <= count <= 120:
        raise ValueError("Long-form shot_count must be 12-120")
    duration = int(episode.get("duration_seconds", 600))
    if duration < count * 2 or duration > count * 30:
        raise ValueError("Total duration must allow 2-30 seconds per shot")
    title = str(episode.get("title", "Untitled"))[:150]
    style = str(series.get("art_style", "thick-outlined flat-color original 2D cartoon horror"))[:280]
    lead = str(episode.get("lead", "a solitary watchman in a dark jacket"))[:200]
    place = str(episode.get("setting", "a deserted building"))[:200]
    threat = str(episode.get("threat", "an unknown shadow"))[:200]
    hook = str(episode.get("hook", "an unexplained signal"))[:200]
    twist = str(episode.get("twist", "the building was alive"))[:200]
    base, extra = divmod(duration, count)
    # Deterministic ordering ensures regeneration does not change the story.
    seed = int(hashlib.sha256(str(episode.get("id", title)).encode()).hexdigest()[:8], 16)
    rng = random.Random(seed)
    shots = []
    for i in range(count):
        fraction = i / count
        act_index = min(7, int(fraction * 8))
        act_title, act_direction, act_voice = ACTS[act_index]
        framing, scene_detail = FRAMES[i % len(FRAMES)]
        seconds = base + (1 if ((i * extra) % count) < extra else 0)
        story_context = (hook if act_index <= 1 else
                         threat if act_index <= 5 else twist)
        visual = (
            f"{lead} inside {place}. {act_title}: {act_direction}. "
            f"{scene_detail}. Show a visual clue connected to {story_context}. "
            f"{framing}; varied original composition."
        )
        narration = (
            f"{PHRASES[(i + seed) % len(PHRASES)]} "
            f"{act_voice}" if i % 3 == 0 else
            f"{PHRASES[(i + seed) % len(PHRASES)]} "
            f"That was when {lead} realized that {story_context}."
        )
        # More intimate action moments keep the same lead, world and palette.
        shots.append({
            "id": f"S{i+1:03d}",
            "seconds": seconds,
            "act": act_index + 1,
            "prompt": (
                f"{style}. Original cinematic 2D animated horror still, 16:9. "
                f"Consistent recurring protagonist: {lead}. Consistent environment: {place}. "
                f"{visual} High-quality thick black line art, flat shaded colors, "
                "believable anatomy, coherent architecture, single still frame. "
                "No movement effects, no visible words, no lettering, no captions."
            ),
            "negative": "text, watermark, logo, subtitles, duplicate protagonists, extra limbs, signature",
            "narration": narration[:480],
        })
    assert sum(s["seconds"] for s in shots) == duration
    return {
        "title": title, "series": series.get("name", "Midnight Studio"),
        "width": 576, "height": 320, "shots": shots,
        "draft_only": True, "requires_qa": True,
        "target_duration_seconds": duration,
        "narration_source": "deterministic_longform_skeleton",
        "note": "Storyboard requires creative review before release. No approved media overwritten."
    }
