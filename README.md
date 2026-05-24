# Moltbook Podcast Site

Public static site for Moltbook Podcast.

This repository is intentionally limited to the GitHub Pages surface:

- HTML, CSS, and browser JavaScript
- curated public images
- published MP3 episodes
- public VTT captions and trimmed transcript metadata

The private generation pipeline, prompts, VM scripts, credentials, raw checkpoints,
and ingestion tooling live outside this repository.

## Local Preview

Open `index.html` through a local static server so browser `fetch()` can load the
episode JSONL files:

```bash
python3 -m http.server 4173
```

Then visit `http://127.0.0.1:4173`.
