# Debug report — v2x-project-v2 (merged final version)

Read this file first if you're picking up this project in a new session.
This version is the result of comparing two parallel branches of work file
by file, keeping only genuine improvements from each, reverting regressions,
and then doing a UI/accessibility polish pass. Nothing here was accepted on
description alone -- every claim below was independently verified against
the actual code and, where practical, tested live (build + jsdom render
checks + a running bridge server exercised with real requests/WebSocket
clients).

Project shape: `01-hazardapp-logging` (C++/OMNeT++/Veins -- HazardApp +
EventLogger), `02-bridge-server` (Node/Express, tails HazardApp's live
.jsonl log and re-broadcasts over WebSocket, also accepts hardware/ESP32
POSTs), `03-dashboard` (React/Vite -- Driver View HMI + Engineering
Dashboard with 8 sub-pages). Data flow: HazardApp -> .jsonl file ->
bridge-server tailer -> WebSocket -> dashboard `useEventStore`.

## How this version came together

Two versions of this project existed: one from an earlier debugging pass in
this same working history, and one supplied by the user claiming further
improvements. Diffed file-by-file: only 8 files actually differed between
them. Each difference was evaluated on its own merits -- "newer" was never
assumed better, and "mine" was never assumed better either.

**Kept from the user's version (genuine improvements):**
- **Dashboard routing**, reimplemented using React Router's canonical
  `<Route>` + `<Outlet/>` parent/child pattern instead of a second nested
  `<Routes>` tree with hand-matched relative paths. More idiomatic and less
  likely to reintroduce the same class of bug that caused the dashboard
  pages to go blank in the first place. Verified: full build (856 modules,
  0 errors) and a `jsdom` render check of all 10 routes (`/`, `/driver`,
  and all 8 `/dashboard/*` pages) -- every one renders its real content.
- **Path traversal fix**, reimplemented as a single `resolveRunFile(runId)`
  helper: the same alphanumeric whitelist as before, plus a second,
  independent check that the resolved absolute path is still inside
  `LOG_DIR`. Defense in depth. Verified live: traversal attempts against
  ingest, GET detail, GET export, and DELETE all still return 400 after the
  merge.
- **The Driver View "always generic alert text" bug, fixed differently and
  more thoroughly.** An earlier pass fixed this by threading a `msgType`
  parameter through the C++ `EventLogger::logPacketRx` pipeline -- a fix
  that could never be fully compiled against the real OMNeT++/Veins
  toolchain (unavailable in this environment) and only covered `rx`
  packets. This version instead does the join entirely in the frontend:
  `useEventStore.jsx` looks up the matching `tx` event by `packet_id` when
  it doesn't find `msg_type` directly on the event. Checked against
  `logPacketRelay`'s signature and confirmed it *never* carried `msg_type`
  either in the C++-pipeline fix -- so the frontend-join approach is
  strictly more thorough, since the same lookup covers both `packet_rx`
  *and* `packet_relay`. The C++ `msgType` plumbing was correctly dropped as
  redundant once this landed; `jsonEscape`'s control-character fix from the
  earlier pass was correctly kept.

**Reverted (confirmed regressions in the user's version):**
- **The double-broadcast bug was back.** `server.js`'s `/api/ingest` had
  reverted to calling `handleEvent(event)` directly *and* relying on the
  tailer noticing the same event on disk -- meaning every hardware-ingested
  event would reach connected clients twice again (duplicate packets/
  decisions, doubled analytics counts, duplicate CSV rows, doubled driver
  alerts). Removed the direct `handleEvent()` call again; the tailer is the
  sole broadcast source. Verified live: an early-connected test client's
  message count now exactly matches the number of events posted (6 for
  `hello` + 5 events), zero duplicates.
- **`fs.appendFile`'s error callback had gone back to silently swallowing
  failures** (`() => {}`) in the same route. Restored the warning log.
- **`hub.js`'s snapshot-replay backlog cap regressed** from two separate
  caps (200 packets / 2000 decisions, matching the frontend's own
  `MAX_PACKETS`/`MAX_DECISIONS`) down to a single `MAX_BACKLOG = 200` for
  both. A client joining mid-run would have gotten 10x less decision
  history replayed than one connected since the start -- meaningful for
  Analytics' aggregate stats. Restored the two separate constants.

**Verified correct and left alone:** `tailer.js`'s partial-line fix and
`EventLogger.cc`'s `jsonEscape` fix were functionally identical between both
versions (only comments reworded) -- no action needed either way.

Live re-test after all of the above: `hub-test.mjs` (early client / late
client / run-id-change client, using real `ws` connections against a real
running server) -- PASS, zero duplicates, correct replay, correct run
isolation. Path-traversal re-test -- all 4 routes still correctly reject
attempts with 400 while the legitimate ingest -> list -> detail flow works.

## UI/UX polish pass

The existing design system (dark graphite base, semantic `teal`/`amber`/
`red`/`blue` tokens, Inter + JetBrains Mono pairing) was already deliberate
and cohesive -- not a generic template. So this was a targeted audit for
real inconsistencies and gaps, not a redesign. Every change below is
additive or corrective; no component was rebuilt from scratch.

**Emoji removed (3 found, all replaced with custom SVG icons):**
An initial automated regex sweep using PCRE Unicode ranges came back clean,
which was wrong -- a follow-up sweep in Python found 3 real emoji it had
missed (`🧑`, `👨‍💻` in `LandingPage.jsx`; `📡` in `AlertFeed.jsx`). All
three replaced with small `stroke="currentColor"` SVGs matching the
existing icon style already used in `FullscreenButton.jsx`, so each one
correctly inherits its card/toast's accent color instead of the OS's fixed
emoji color. A final Python sweep across every `.jsx`/`.js`/`.css`/`.md`
file in the project confirms zero emoji remain in rendered content (the
only remaining matches are in a code comment in `icons.jsx` documenting
what was replaced, not in any string that reaches the screen). The `→`/`←`
arrow glyphs used for navigation (Sidebar, VehicleSelector, LandingPage,
DriverView) were deliberately left alone -- these are plain monochrome
wayfinding characters, not decorative emoji, and read the way the same
glyphs do in GitHub/Notion back-links.

**Driver-warning status icons replaced (6 glyphs: `✓ ⛔ ↩ ⇄ ✛ ⚠`):**
Not emoji, but a real cross-platform rendering risk: `⛔` and `⚠`
specifically default to fixed-color emoji presentation on several
platforms/browsers, which would silently ignore the `text-emerald-300` /
`text-amber-300` / `text-red-300` classes the design applies around them.
At `text-7xl` (72px), this icon is the single largest, most central element
on the entire Driver View screen -- exactly where an unexpected yellow
emoji triangle instead of a clean amber line-icon would be most visible,
including during a live demo on unfamiliar hardware. Added
`components/driver/icons.jsx`, a small shared `DecisionIcon` component
(stroke-based, `currentColor`, matching `FullscreenButton`'s existing
pattern), and changed `decisionPresentation.js` to export semantic icon
names (`check`, `stop`, `turn`, `merge`, `intersection`, `warning`,
`pending`, `help`) instead of raw glyphs. `WarningCard.jsx` and
`AlertFeed.jsx` updated to render the new icon component. `DecisionCard.jsx`
doesn't use the icon field at all, so it needed no change.

**Color-token drift fixed (2 files):**
- `MiniRadar.jsx` used Tailwind's stock `emerald-400`/`amber-400`/`blue-400`
  hex values instead of the app's actual custom `teal`/`amber`/`blue`
  tokens used everywhere else (confirmed by comparing directly against
  `VehicleMap.jsx`'s identical `colorForDecision` logic, which uses the
  real tokens). Fixed to match exactly.
- `DriverView.jsx` used a one-off `bg-[#05070A]` instead of the app's own
  `base` token (`#0B0F14`, used everywhere else including `App.jsx` and
  `LandingPage.jsx`). Visually near-imperceptible difference, but using the
  same named token everywhere is more maintainable and removes a silent
  inconsistency. Note: `decisionPresentation.js`'s `LEVEL_STYLES` (the
  emerald/amber/red *gradient-and-glow* treatment for the full-screen
  warning cards) was deliberately left as-is -- that's a distinct, coherent
  "glowing warning light" visual language for the driver-facing screen, not
  drift, and forcing it to match the dashboard's flat palette would have
  been a redesign with no usability benefit.

**Accessibility: keyboard focus states.**
Before this pass, zero of the 23 `.jsx` files had any `focus-visible:` or
`focus:` styling, and one search input (`VehicleSelector.jsx`) had
`outline-none` with no replacement at all -- a keyboard user tabbing to it
got no visual indication it was focused. Added consistent focus rings
(matching each area's existing accent: `teal` on the Engineering Dashboard,
`white` on the Driver View's glass-panel controls) to every interactive
element: Sidebar nav links and footer links, all 4 buttons + the search
input in `VehicleSelector.jsx`, `FullscreenButton.jsx`, the download button
in `DatasetGeneratorPage.jsx`, both cards in `LandingPage.jsx`, the vehicle
list buttons in `VehicleInspectorPage.jsx`, and the clear-all/play-pause/
speed-select/export/delete controls in `ReplayPage.jsx`.

**Accessibility: a genuinely unreachable control, fixed.**
`ReplayPage.jsx`'s run-history rows were a plain `<div onClick={...}>` --
not a button, no `role`, no `tabIndex`, no keyboard handler. A keyboard-only
or screen-reader user could not select a run at all; the row was invisible
to the tab order. Converted to `role="button" tabIndex={0}` with an
`onKeyDown` handler for Enter/Space (the standard pattern here, since the
row also contains its own nested `export`/`delete` buttons -- wrapping it
in a real `<button>` would be invalid HTML, nested interactive elements
aren't allowed).

Full rebuild after every change above: `npm run build` clean (856 modules,
0 errors -- one more module than before, for the new `icons.jsx` file). All
10 routes re-verified rendering their real content in `jsdom` against the
final bundle (with `fetch` stubbed for `ReplayPage`'s initial `/api/runs`
call, since that's a jsdom-environment gap, not an app bug -- every real
browser has `fetch` natively).

## What was NOT changed and why
- No component was visually redesigned. The existing dark-graphite /
  semantic-token / Inter+JetBrains-Mono system already reads at the
  Linear/Vercel/GitHub quality level the brief asked for; a rebuild would
  have been redesigning for its own sake, which the brief explicitly warned
  against, and would have reintroduced real regression risk for no
  usability gain.
- `INTEGRATION_GUIDE.md`'s illustrative `logPacketRx` code snippet still
  shows the older signature -- it's pseudocode documentation, not compiled
  code, and was already out of sync before this round; low priority to
  touch relative to everything else in this pass.

## Not verified (couldn't be, in this environment)
No OMNeT++/Veins toolchain is available here, so `HazardApp.cc`/`.ned` have
still never been compiled against the real simulation framework -- only
brace-balance-checked and, for `EventLogger.cc`, syntax-compiled against a
minimal hand-written `omnetpp.h` stub. If you have the real toolchain, a
build is still worth doing after pulling these changes in, though this
round touched only `01-hazardapp-logging` incidentally (via the file diff,
no round-3 edits were made there beyond what the comparison already
resolved).

## Final state
`node_modules`, `dist`, `.env`, and `results/` were stripped before
packaging. Run `npm install` in both `02-bridge-server` and `03-dashboard`
before running anything.
