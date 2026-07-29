# RUN_GUIDE — V2X Dashboard (5-minute start)

## Prerequisites
Veins 5.3.1 · OMNeT++ 6.1 · SUMO · Node.js 18+ · npm · a shell (PowerShell **or** Git Bash — pick one and stay consistent; their syntax for env vars differs, see below)

## Folder structure
```
v2x-project/
├─ 01-hazardapp-logging/   EventLogger.h/.cc + HazardApp.h/.cc/.ned → copy into src/veins/modules/application/traci/
├─ 02-bridge-server/       Node/Express/WebSocket bridge
└─ 03-dashboard/           React dashboard (Landing / Driver View / Engineering Dashboard)
```

## Ports
`8080` bridge server (HTTP + WebSocket at `/ws`) · `5173` dashboard dev server

## Startup order (3 terminals, all left running)

**1 — Bridge server**
```bash
cd 02-bridge-server && npm install
cp .env.example .env   # edit VEINS_EXAMPLES_ROOT to the ABSOLUTE path of your veins .../examples folder
npm start
```
This is a one-time setup, not per-scenario: `VEINS_EXAMPLES_ROOT` points at the whole `examples/` folder, and the bridge recursively finds every `<scenario>/results/live` under it on its own. Confirm the printed `[scenario-registry] watching N live folder(s):` block lists every scenario you expect to run.

**2 — Dashboard**
```bash
cd 03-dashboard && npm install
cp .env.example .env
npm run dev
```
Open the printed `localhost:5173` URL → choose **Driver View** or **Engineering Dashboard**.

**3 — Simulation** (rebuild once after copying `01-hazardapp-logging/` files into `src/veins/modules/application/traci/` and running `make clean && make -j4` from the veins root)
```bash
cd examples/<scenario>
opp_run.exe -u Cmdenv -c LiveDemo -n ".;../../src/veins" "--image-path=../../images" -l "../../src/veins" omnetpp.ini
```
`-c LiveDemo` paces sim-time to wall-clock time — required for the dashboard to look "live" instead of the run finishing before you see anything.

Run any other scenario the same way, from its own `examples/<scenario>` folder, with no bridge restart and no `.env`/code change — the dashboard switches to it automatically as soon as it starts writing events, and switches back the same way if you re-run an older scenario afterwards (whichever run is newest wins).

## Quick verification checklist
- [ ] `curl(.exe) -s http://localhost:8080/api/health` → `"ok":true`, `watching` lists one entry per scenario folder found under `VEINS_EXAMPLES_ROOT` (plus `hardware`)
- [ ] `curl(.exe) -s http://localhost:8080/api/runs` → lists runs with `event_count > 0` after a sim runs, across every scenario you've run, not just the most recent one
- [ ] Dashboard top bar shows **"connected"**, plus the auto-detected `scenario` (folder name) and `run` (file name) of whichever simulation is currently active
- [ ] Start a second scenario while the first is still running — the top bar switches to the new one within ~2 seconds, with no manual action
- [ ] Driver View vehicle selector shows real vehicle IDs from the current run (never hardcoded)

## Common troubleshooting (all real issues hit building this)
| Symptom | Cause | Fix |
|---|---|---|
| `.env` changes have no effect | Plain Node doesn't auto-load `.env` | Already fixed — `server.js` imports `dotenv/config`. If still broken: `npm install` in `02-bridge-server` (dotenv missing from `node_modules`). |
| Bridge isn't watching any scenario folders | `VEINS_EXAMPLES_ROOT` unset, wrong, or points below the `examples` folder | Set the **absolute** path to the `examples` folder itself in `.env` (not a specific scenario's subfolder), then restart the bridge — env vars are only read once, at startup. |
| A scenario's runs never show up, even with `VEINS_EXAMPLES_ROOT` correct | That scenario writes its `.jsonl` files somewhere other than `<scenario>/results/live` (e.g. a leftover `HAZARD_LOG_DIR` override pointing elsewhere) | Remove any `HAZARD_LOG_DIR` env var from your run/batch scripts — auto-detection expects each scenario's own default `results/live` folder, not one shared folder. |
| `results/live` stays empty | Sim's CWD isn't `examples/<scenario>` | Relative paths resolve against CWD, not the `.ini` file location — `cd` into the scenario folder before running `opp_run.exe`. |
| PowerShell `curl -s` errors ("Supply values for Uri") | `curl` is aliased to `Invoke-WebRequest` in PowerShell | Use `curl.exe` explicitly, or `Invoke-RestMethod`. |
| Git Bash: `Tee-Object`/`$env:X=` don't work | Those are PowerShell-only | Bash equivalents: `| tee file.log`, `export X=value`. |
| Linker error `undefined symbol EventLogger::...` | `EventLogger.cc` not in the Makefile | `opp_makemake -f --deep` from the veins root, then `make clean && make -j4`. |
| `ASSERT '!event->isStale()'` mid-run | Self-message (timer) not cancelled when a vehicle's module is deleted (e.g. exits its route) | Already fixed — `HazardApp`'s destructor calls `cancelAndDelete()` on every timer. |
| NED "declared package does not match expected package" | An extra/duplicate NED root (stale `NEDPATH` env var, or a second Veins checkout) is merged in alongside `-n` | Check `$env:NEDPATH` / `echo $NEDPATH` is empty; verify `src/veins/package.ned` contains exactly `package org.car2x.veins;`. |
