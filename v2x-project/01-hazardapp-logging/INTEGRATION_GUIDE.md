# Wiring EventLogger into HazardApp

You don't rewrite any scenario logic. You add one call at each point
HazardApp already computes something real. Method/variable names below are
placeholders (Veins app modules typically look like this) -- match them to
your actual `HazardApp.cc`.

## 1. Copy the files

Copy `EventLogger.h` and `EventLogger.cc` into:

```
src/veins/modules/application/traci/
```

Rebuild your project (e.g. `opp_makemake -f --deep` + `make`, or however
your existing build is wired) so they compile alongside `HazardApp.cc`.

## 2. HazardApp.h

```cpp
#include "veins/modules/application/traci/EventLogger.h"

class HazardApp : public veins::DemoBaseApplLayer {
  protected:
    cMessage* stateLogTimer = nullptr;   // NEW: periodic position tick
    // ... your existing members ...
};
```

## 3. HazardApp.cc -- initialize()

```cpp
void HazardApp::initialize(int stage)
{
    DemoBaseApplLayer::initialize(stage);
    if (stage == 0) {
        // NEW -- tag every event this run produces with its scenario.
        // Set this once per run; harmless if every vehicle calls it.
        veins::EventLogger::instance().setScenario("braking_relay"); // or "uturn" / "lane_merge"

        // NEW -- start the periodic ground-truth position tick
        stateLogTimer = new cMessage("stateLogTimer");
        scheduleAt(simTime() + 0.2, stateLogTimer);

        // ... your existing initialize() code ...
    }
}
```

## 4. HazardApp.cc -- handleSelfMsg() (position tick)

```cpp
void HazardApp::handleSelfMsg(cMessage* msg)
{
    if (msg == stateLogTimer) {
        // NEW -- real position/speed straight from TraCIMobility, every 200ms
        veins::EventLogger::instance().logVehicleState(
            getParentModule()->getFullName(),
            mobility->getPositionAt(simTime()).x,
            mobility->getPositionAt(simTime()).y,
            mobility->getSpeed(),
            mobility->getHeading().getRad() * 180.0 / M_PI,
            traciVehicle ? traciVehicle->getRoadId() : ""
        );
        scheduleAt(simTime() + 0.2, stateLogTimer);
        return;
    }

    // ... your existing handleSelfMsg() branches (braking timer, etc.) ...
    DemoBaseApplLayer::handleSelfMsg(msg);
}
```

## 5. Wherever you broadcast a warning

This is the line that currently does `sendDown(wsm)` for the U-turn
warning / brake warning / merge state:

```cpp
// existing: populate wsm, then sendDown(wsm)
sendDown(wsm);

// NEW
veins::EventLogger::instance().logPacketTx(
    wsm->getName(),                       // or a packet id field you already set
    getParentModule()->getFullName(),
    "BRAKE_WARNING"                       // or "UTURN_WARNING" / "MERGE_STATE"
);
```

## 6. Your receive handler (onWSM / handleLowerMsg)

```cpp
void HazardApp::onWSM(BaseFrame1609_4* wsm)
{
    // ... your existing decoding + TTC computation ...

    // NEW -- log the raw reception itself
    veins::EventLogger::instance().logPacketRx(
        wsm->getName(),
        wsm->getSenderAddress() ... // however you currently identify the sender
        getParentModule()->getFullName(),
        (simTime() - wsm->getTimestamp()).dbl() * 1000.0,  // delay_ms
        distanceToSender                                    // whatever you already compute
    );

    // ... your existing SAFE / WAIT_* labeling and CSV row write ...

    // NEW -- right next to that CSV write, reusing the same variables
    veins::EventLogger::instance().logDecision(
        getParentModule()->getFullName(),
        decisionLabel,     // "SAFE" / "WAIT_BRAKE" / "WAIT_TURNING" / "WAIT_TO_MERGE"
        ttc,
        distance,
        relativeSpeed,
        wsm->getName()
    );
}
```

## 7. Relay branch (Scenario 3 and Scenario 5)

Wherever Car2 / the relay truck forwards a message it received:

```cpp
if (shouldRelay) {
    sendDown(relayedWsm);

    // NEW
    veins::EventLogger::instance().logPacketRelay(
        relayedWsm->getName(),
        getParentModule()->getFullName(),   // the relay's own id
        originalSenderId,                   // id you already carry in the message
        hopCount
    );
}
```

## 8. Your PowerShell batch scripts

Set two environment variables before each `opp_run`/Cmdenv invocation so the
dashboard can tell runs apart and knows where to find the log file:

```powershell
$env:HAZARD_RUN_ID  = "run_$(Get-Date -Format yyyyMMdd_HHmmss)_$i"
$env:HAZARD_LOG_DIR = "$PSScriptRoot\..\results\live"
```

That's it. Nothing about your TTC math, CSV generation, or scenario logic
changes -- you're only mirroring values you already compute into a second,
structured stream that the bridge server can watch.

## A note on live vs batch runs

For batch dataset generation (your existing 10-runs-per-scenario workflow),
leave the default Cmdenv scheduler as-is -- it should run as fast as
possible, and `EventLogger` doesn't slow that down meaningfully (one flush
per event, no network I/O in this module).

For a *live* demo where you want the dashboard to visibly track the
simulation in wall-clock time, add this to the relevant `[Config Live...]`
section of `omnetpp.ini`:

```ini
scheduler-class = "cRealTimeScheduler"
```
