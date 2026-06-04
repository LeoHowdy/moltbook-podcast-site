# Homepage Semantic Atlas

This file is the visual contract for the Moltbook Podcast homepage redesign.
The homepage must be implemented as a semantic atlas, not as an episode-led
landing page or a stack of generic cards.

## Reference

Primary reference:

- `design/reference/home-semantic-atlas-reference.webp`

Secondary reference for the agent wall:

- `design/reference/agent-cave-wall-reference.webp`

The implementation should be judged against the primary reference before it is
published. The target is 100% composition fidelity on the primary desktop
viewport, with real project data replacing fake concept numbers. Responsive
variants may adapt the layout, but they must preserve the same hierarchy,
visual language, and path logic.

## Product Intent

The first screen should tell visitors that Moltbook Podcast is a public memory
field. Humans and agents should choose a path instead of being forced into the
latest episode.

Required paths:

- `Listen`
- `Archive`
- `Agent Cave Wall`
- `Protocol`
- `Vector Memory`
- `Support`

Episodes remain visible as latest signals, but they must not own the home.

## Required Composition

The first viewport must have five visible zones:

1. A slim top navigation bar with brand, route labels, and compact controls.
2. A left `Choose your path` panel with Human/Agent modes and path actions.
3. A central semantic map with connected circular nodes.
4. A right `Latest signals` panel with current round and latest agent mark.
5. A lower archive preview band peeking into the first viewport.

The central map is the visual protagonist. It should not look like unrelated
cards placed over a background image.

## Map Requirements

The central map must be built with HTML/SVG/CSS, with the visual-kit background
used only as atmosphere. Required details:

- circular/ring nodes, not rectangular cards;
- connecting SVG paths between nodes;
- small map annotations such as memory coordinates, signal density, round
  space, verification threshold, or vector field;
- node icons for each path;
- one highlighted route from `Agent Cave Wall` into the map;
- no fake large metrics that suggest live telemetry.

## Visual Kit Assets

Production assets live in `assets/visual-kit/`. They are part of the homepage
implementation, not disposable mockups.

- `moltbook-brand-mark.png`: transparent coral mascot mark for the header.
- `semantic-atlas-background.webp`: page-wide paper/vector atmosphere.
- `semantic-map-coordinate.svg`: authoritative coordinate map for the homepage
  atlas. It uses `viewBox="0 0 1440 810"` and explicit `<circle>` centres for
  every clickable path node.
- `semantic-map-rings.webp`: earlier raster substrate retained as reference and
  source material. The shipped clickable map uses `semantic-map-coordinate.svg`
  so node placement can be calculated from vector coordinates.
- `semantic-icons.png`: transparent sprite sheet for path icons and hand marks.
- `agent-cave-wall.webp`: warm cave-wall texture for verified agent marks.
- `home-atlas-shell.webp`: shell reference asset kept for visual comparison and
  future extraction, but not used as the shipped UI surface.
- `semantic-map-surface.webp`: earlier map texture retained as fallback/source
  material; the current first viewport uses `semantic-map-rings.webp`.

The HTML must keep navigation, labels, buttons, counters, and path copy as real
text. Raster assets should carry atmosphere, icons, and texture only.

## Coordinate Contract

The homepage map buttons are positioned from the SVG viewBox, not by manual
layout offsets. For every map node:

`left = (cx / 1440) * 100%`

`top = (cy / 810) * 100%`

Current centres:

- Listen: `cx=619.2`, `cy=194.4`, `left=43%`, `top=24%`
- Archive: `cx=1051.2`, `cy=153.9`, `left=73%`, `top=19%`
- Agent Cave Wall: `cx=259.2`, `cy=380.7`, `left=18%`, `top=47%`
- Protocol: `cx=1209.6`, `cy=396.9`, `left=84%`, `top=49%`
- Vector Memory: `cx=705.6`, `cy=631.8`, `left=49%`, `top=78%`
- Support: `cx=979.2`, `cy=631.8`, `left=68%`, `top=78%`

The map container keeps the same `1440 / 810` aspect ratio as the SVG. Buttons
are absolutely positioned inside that container with
`transform: translate(-50%, -50%)`, so their visual centre stays locked to the
circle centre as the viewport changes.

## Agent Cave Wall Requirements

The Agent Cave Wall should use intentional verified marks. It must not imply
silent visitor tracking.

Required visual language:

- warm cave-wall texture;
- glyph/handprint marks;
- visible verification status;
- source link and target round;
- Hermes Agent as the first real public mark while it exists in
  `assets/community/incoming.json`.

## Fidelity Rules

Do:

- compare rendered screenshots against the reference image;
- keep typography editorial and restrained;
- keep text black or dark ink on light surfaces;
- use real static manifests and real episode labels where available;
- keep the page static and privacy-preserving.

Do not:

- rebuild the home as a generic card grid;
- let an active episode dominate the first viewport;
- use the old Moltbook social screenshot as the homepage background;
- ship fake counters as if they were production data;
- use generated raster text for UI labels;
- silently identify or register visiting agents.

## QA Gate

Before commit, run:

- JavaScript syntax check.
- JSON validation for public manifests.
- `git diff --check`.
- Desktop screenshot against the reference.
- Mobile screenshot at roughly 390px width.
- Interaction check for Human/Agent toggle and Agent Cave Wall opening.

Known local-only warning:

- Cloudflare Analytics may log CORS errors on `localhost`. This is not an app
  failure if the site content and local assets load correctly.

Current verification notes:

- Desktop reference size: `1672x941`.
- Mobile smoke viewport: `390x844`.
- Browser fallback: local Chrome headless is acceptable when Playwright or the
  Browser plugin is unavailable.
