# OCCUPANCY V5 production workflow

Full-resolution artwork is delivered to Google Drive as individual numbered JPEGs inside batch folders under the established OCCUPANCY V5 project folder. The user can download folders together as a ZIP. Existing GitHub binary assets remain preserved; new image bytes do not need duplicate GitHub uploads.

GitHub retains the cumulative production tracker, per-batch SHA-256/size manifest, exact Drive image IDs and links, generation prompts, and QA decisions. Each batch uses one metadata commit after verified Drive uploads. Set github_status to DRIVE_MASTER_INDEXED for new Drive-backed artwork; do not claim image bytes are committed.

Generate separate images concurrently in batches of up to twelve, each with the approved character/style reference and any known architecture/prop reference. Inspect every result. Reject or repair character, lighting, geography or continuity mismatches before approval. No collages.

For prop-only and architecture-only images, describe the reference as style-only and omit unnecessary character descriptions. This reduces unwanted character insertions and repair calls.

Normalize approved images to 1920x1080. Upload distinct files concurrently in bounded groups. Save partial completion as needed; final tracker update is cumulative. Verify returned Drive file identity and parent folder before recording delivery.

Never regenerate existing reviewed slots. Keep exact measurements, room counts, floor plans and precise typography in editorial compositing. Original 9:05 narration and approved sound mix remain locked. Finish original anchor relinking and narration alignment before declaring the complete episode finished.
