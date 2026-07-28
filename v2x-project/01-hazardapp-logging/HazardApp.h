//
// HazardApp — shared application layer for the hazard-relay scenarios:
//   Scenario 2 (U-Turn Safety)          — roles EGO_TURN / FOLLOWER, IDs "carA"/"carB"
//   Scenario 3 (Sudden Braking Relay)   — roles BRAKE_LEADER / RELAY / TAIL, IDs "car1".."carN"
//   Scenario 4 (Blind Intersection)     — role INTERSECTION (symmetric), IDs "carX"/"carY"
//   Scenario 5 (Lane Change / Merge)    — roles MERGE_TARGET/TRUCK_RELAY/MERGE_EGO, IDs "carD"/"truckR"/"carM"
//
// One class handles all three because the underlying mechanism is similar: a
// vehicle detects/triggers a hazard, broadcasts a HazardMessage, and a
// receiver computes a SAFE/WAIT decision and logs it. Scenarios 2/3 share the
// same-line "closing distance / TTC" math (evaluateAndLog). Scenario 4 is
// architecturally different — two vehicles approach a blind crossroads on
// PERPENDICULAR roads, so raw distance-between-them isn't the safety-relevant
// number; it needs its own ETA-to-the-crossing-point comparison
// (evaluateIntersectionAndLog), and both vehicles play the same symmetric
// role and beacon continuously rather than one triggered event. Scenario 5
// reuses the SAME ETA-comparison math for a converging merge point instead of
// a crossing point, but adds a relay (Truck B, sitting between Car D and the
// merging Car A) — Car A's decision logic only acts on messages explicitly
// tagged as relayed (senderRole=="relay_truck"), modeling the fact that the
// truck visually/physically blocks Car A from seeing Car D directly. NOTE:
// this is a logical/behavioral simplification, not real radio LOS-blocking
// (Veins' VehicleObstacleShadowing model) — deliberate, to avoid the same
// obstacle-config fragility that broke Scenario 2 earlier tonight, and
// because what matters for the ML dataset is the relayed feature set, not
// the physical blocking mechanism. Documented in scenario 5's README.
//
// Verified against veins-5.3.1 source:
//   - DemoBaseApplLayer.h: protected members mobility/traci/traciVehicle/curPosition,
//     override points onWSM()/handlePositionUpdate()/handleSelfMsg(), send path
//     populateWSM()/sendDown()
//   - DemoBaseApplLayer.cc: traciVehicle is assigned in stage 0, before our own
//     stage-0 code runs (we call the base initialize() first)
//   - TraCICommandInterface.h: Vehicle::slowDown(double speed, simtime_t time)
//     is the real API used to script Car1's hard brake in Scenario 3
//

#pragma once

#include <fstream>
#include <string>
#include "veins/modules/application/ieee80211p/DemoBaseApplLayer.h"
#include "EventLogger.h" // dashboard live-event log — additive, does not affect CSV/decision logic

namespace veins {

class HazardMessage;

class VEINS_API HazardApp : public DemoBaseApplLayer {
public:
    ~HazardApp() override;
    void initialize(int stage) override;
    void finish() override;

protected:
    enum class Role {
        UNKNOWN,
        EGO_TURN,      // Scenario 2: carA, slows for U-turn, sends TURN_WARNING
        FOLLOWER,      // Scenario 2: carB, receives TURN_WARNING, decides
        BRAKE_LEADER,  // Scenario 3: car1, scripted hard-brake, sends BRAKE_WARNING
        RELAY,         // Scenario 3: middle car(s), decide AND re-broadcast
        TAIL,          // Scenario 3: last car in chain, decides, does not re-broadcast
        INTERSECTION,  // Scenario 4: carX/carY, symmetric, both beacon + decide
        MERGE_TARGET,  // Scenario 5: carD, broadcasts its own status continuously
        TRUCK_RELAY,   // Scenario 5: truckR, relays carD's status to carM, does not decide
        MERGE_EGO      // Scenario 5: carM, decides — ONLY on relayed (truck) messages
    };

    void onWSM(BaseFrame1609_4* wsm) override;
    void handlePositionUpdate(cObject* obj) override;
    void handleSelfMsg(cMessage* msg) override;

    void sendTurnWarning();
    void triggerScriptedBrake();
    void relayBrakeWarning(HazardMessage* received);
    void relayMergeStatus(HazardMessage* received);
    void sendIntersectionBeacon();
    void evaluateAndLog(double senderPosX, double senderPosY, double senderSpeed, double originTimestampSec, int hopCount, const std::string& waitLabel);
    void evaluateIntersectionAndLog(double peerPosX, double peerPosY, double peerSpeed, double originTimestampSec, const std::string& waitLabel);
    void logDecision(const std::string& label, double distance, double relativeSpeed, double ttc, int hopCount, double messageAgeMs);

protected:
    Role role;
    bool warningSent;    // Scenario 2: carA already sent its one warning
    bool alreadyRelayed; // Scenario 3: RELAY nodes forward the warning exactly once

    std::string logFilePath;
    int scenarioId;
    double turnSpeedThreshold; // m/s — Scenario 2: below this, carA is considered "slowing/turning"
    double waitTimeThreshold;  // s   — TTC threshold below which the decision is WAIT (scenarios 2/3)

    // Scenario 3 only
    int chainLength;           // total number of vehicles in the braking chain (car1..carN)
    double brakeTriggerTime;   // s, simulation time at which car1's scripted brake fires
    double brakeTargetSpeed;   // m/s, target speed car1 slows to
    double brakeDuration;      // s, how long the TraCI slowDown transition takes
    cMessage* brakeTimer = nullptr;

    // Scenario 4 only
    double intersectionCenterX; // m, world coords of the crossing point (matches nod.xml)
    double intersectionCenterY;
    double collisionWindowThreshold; // s — if both vehicles' ETA to center differ by less than this, WAIT
    double relevantRadius;           // m — only evaluate/log once within this distance of center
    double beaconInterval;           // s — how often INTERSECTION-role vehicles broadcast their status
    cMessage* beaconTimer = nullptr;

    // Dashboard-only: every vehicle (any role) reports its real TraCI position
    // on this tick, independent of the scenario's own event-triggered sends.
    cMessage* stateLogTimer = nullptr;
    static constexpr double kStateLogIntervalSec = 0.2;

    // batch-run metadata, supplied per-run from the command line (see run_batch*.ps1) —
    // these don't affect simulation behavior, they're just recorded into every logged row
    // so a large multi-run dataset can be traced back to the parameters that produced it
    int runNumber;
    int randomSeedUsed;
    double initialGapM;
    double carASpeedInit;
    double carBSpeedInit;

    // shared across all module instances (all vehicles run in one process) so every
    // vehicle's decisions land in the same CSV file
    static std::ofstream logStream;
    static bool headerWritten;
};

} // namespace veins
