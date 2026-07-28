# What changed, and why

This is your actual `HazardApp.h` / `HazardApp.cc` (unified across all four
scenarios, as your class comment describes), with `EventLogger` wired in.
Your CSV logic, TTC/ETA math, and role assignment are untouched — every
change is additive.

## Files in this folder

- `HazardApp.h`, `HazardApp.cc` — your files, patched.
- `HazardApp.ned` — unchanged, included for completeness.
- `EventLogger.h`, `EventLogger.cc` — new, drop in alongside them.
- `omnetpp.ini` — your file, with one new `[Config LiveDemo]` section added.
- `run_batch5.ps1` — your file, with two lines added so each of the 200
  batch runs gets a readable run id for the dashboard's Replay page.

## Where to put them

All five `.h`/`.cc` files go in the same folder you already use:
`src/veins/modules/application/traci/`. Rebuild as usual.

## Exactly what was added, by location

| Where | What |
|---|---|
| `HazardApp.h` | `#include "EventLogger.h"`; one new member `stateLogTimer` |
| `initialize()` | Tags the run with a scenario name (`uturn`/`braking_relay`/`blind_intersection`/`lane_merge`); starts a 0.2s position tick for every vehicle |
| `handleSelfMsg()` | Handles the new tick: logs real `curPosition`/speed/heading, reschedules |
| `sendTurnWarning()`, `triggerScriptedBrake()`, `sendIntersectionBeacon()` | One `logPacketTx()` call each, right after the existing `sendDown()` |
| `onWSM()` | One `logPacketRx()` call at the top — fires for *every* real reception, before your role/eventType branches decide what to do with it |
| `relayBrakeWarning()`, `relayMergeStatus()` | One `logPacketRelay()` call each, after `sendDown()` |
| `logDecision()` | One `EventLogger::instance().logDecision(...)` call, reusing the exact label/ttc/distance/relativeSpeed your CSV row already uses |

A packet's tx → relay → rx are linked by one id derived from
`originId + eventType + originTimestamp` — the three fields your own
`relayBrakeWarning()`/`relayMergeStatus()` already carry forward unchanged
on every hop. That's what lets the dashboard's packet timeline and network
graph show a message's full journey as one thing, not disconnected events.

## Verifying it compiles

I can't compile this here (no OMNeT++/Veins toolchain in this sandbox) — I
checked it by hand and the braces/parens balance, but please do a real build
before your next batch run. If `opp_makemake`/`make` complains, the most
likely spots are ones that depend on exact Veins API in your installed
version:

- `mobility->getExternalId()` — used elsewhere in your file already, so this
  should be fine.
- `wsm->getOriginId()`, `->getEventType()`, `->getSenderId()`,
  `->getOriginTimestamp()` — all already used elsewhere in your file.
- `EventLogger::instance()` — the only genuinely new API surface. If this
  doesn't link, check that `EventLogger.cc` is actually picked up by your
  build (same folder, so `opp_makemake --deep` should find it automatically).

## Verifying it works

1. Run one simulation (any config). Confirm
   `results/live/<run_id>.jsonl` appears and grows — `tail -f` it while
   the sim runs.
2. Spot-check a `packet_relay` line's `packet_id` matches the `packet_tx`
   line it came from (same `originId-eventType-originTimestamp` string).
3. Confirm `results/scenario5_dataset.csv` still gets exactly the rows it
   did before — nothing about that path changed.

## For a live (real-time) demo

Run with `-c LiveDemo` instead of `-c LaneMerge`:

```
opp_run.exe -u Cmdenv -c LiveDemo -n ".;../../src/veins" "--image-path=../../images" -l "../../src/veins" omnetpp.ini
```

This paces the simulation to wall-clock time so the dashboard's Live
Simulation page visibly tracks it instead of the whole run completing
before the first WebSocket message even renders. Keep batch generation
(`run_batch5.ps1`, `-c LaneMerge`) on the default fast scheduler — no
change needed there.
