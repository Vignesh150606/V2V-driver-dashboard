# V2X monitoring console — integration project

Three parts, wired in the order data actually flows:

```
SUMO → Veins/OMNeT++ → HazardApp → 01 (EventLogger)
                                      ↓ writes .jsonl
                              02-bridge-server (tails file, WebSocket + REST)
                                      ↓
                              03-dashboard (React, live map + timeline + replay)
```

Nothing in the dashboard is invented. Vehicle positions come from
`mobility->getPositionAt()` via TraCI. Packet transmissions, relays, and
receptions are logged exactly where HazardApp already performs them.
Decisions (`SAFE`, `WAIT_BRAKE`, `WAIT_TURNING`, `WAIT_TO_MERGE`) are logged
next to the same CSV row you already write today.

## Run order

### 1. Wire HazardApp (`01-hazardapp-logging/`)

Read `INTEGRATION_GUIDE.md`. Copy `EventLogger.h`/`.cc` into
`src/veins/modules/application/traci/`, add the calls shown in the guide at
your existing broadcast/receive/relay/decision points, and rebuild.

Verify it: run one Cmdenv simulation and confirm
`results/live/<run_id>.jsonl` fills up with one JSON line per event.

### 2. Start the bridge (`02-bridge-server/`)

```bash
cd 02-bridge-server
npm install
cp .env.example .env      # point HAZARD_LOG_DIR at the same results/live folder
npm start
```

Verify it: `curl http://localhost:8080/api/health` should report
`"watching"` pointed at your log directory. Run a simulation and
`curl http://localhost:8080/api/runs` should list it.

### 3. Start the dashboard (`03-dashboard/`)

```bash
cd 03-dashboard
npm install
cp .env.example .env      # VITE_WS_URL=ws://localhost:8080/ws for local dev
npm run dev
```

Open the printed localhost URL. With the bridge running and a simulation
active (ideally with `scheduler-class = "cRealTimeScheduler"` set for that
run, see the integration guide), vehicles should appear on the **Live
simulation** page and move as SUMO moves them.

## Deploying

- **Portfolio / always-online version**: `npm run build` in `03-dashboard`,
  deploy the `dist/` folder to Vercel. Point `VITE_WS_URL` (as a Vercel env
  var) at nothing — instead use the **Replay** page, which reads recorded
  runs over plain HTTPS from wherever you host the bridge's `/api/runs`
  data. This is what stays up permanently with zero dependency on your
  laptop being on.
- **Live demo version**: run the bridge locally, expose it with a tunnel
  (ngrok / Cloudflare Tunnel) to get a public `wss://` URL, set that as
  `VITE_WS_URL` on your Vercel deployment (or just run the dashboard
  locally too — more reliable for a viva where you don't want to depend on
  conference wifi and a tunnel staying up).

## Adding real hardware later

`02-bridge-server` already exposes `POST /api/ingest`, which accepts the
exact same JSON event schema HazardApp writes (just with `"source":
"hardware"`). An ESP32 vehicle can `HTTPClient.POST()` the same shape over
WiFi and it will appear on the dashboard exactly like a simulated vehicle —
no dashboard code changes required. See the `payload` shapes used in
`EventLogger.cc` for the exact fields to send.

## What's simplified for a first pass (documented, not hidden)

- Positions are plotted in HazardApp's raw local coordinate space, not
  georeferenced lat/lon — the map auto-scales to fit whatever vehicles are
  present. Converting to lat/lon via `traci.simulation.convertGeo()` is a
  natural next step if you want a real street-map tile background.
- The bridge stores runs as flat `.jsonl` files, not a database — fine for
  a final-year project's dataset scale; swap in SQLite if you outgrow it.
- The "Dataset generator" page shows and exports the decisions arriving in
  the *current* live session. Kicking off a new PowerShell batch run from
  the dashboard itself is a reasonable next feature, but intentionally left
  out here since it means the web backend can execute local scripts —
  worth doing deliberately with proper access control, not as a first pass.
