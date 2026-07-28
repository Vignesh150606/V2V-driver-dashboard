#include "HazardApp.h"
#include "HazardMessage_m.h"

#include <cmath>
#include <cstring>
#include <cctype>
#include <sstream>

using namespace veins;

Define_Module(veins::HazardApp);

namespace {
// originId/eventType/originTimestamp are the three fields relayBrakeWarning()
// and relayMergeStatus() explicitly copy from the received message rather
// than regenerating — so this id is identical across a tx, every relay hop,
// and every rx of the SAME underlying hazard event. That's what lets the
// dashboard's packet timeline and network graph group them as one packet's
// journey instead of unrelated events.
std::string makePacketId(const std::string& originId, const std::string& eventType, double originTimestampSec)
{
    std::ostringstream oss;
    oss << originId << "-" << eventType << "-" << originTimestampSec;
    return oss.str();
}
} // namespace

std::ofstream HazardApp::logStream;
bool HazardApp::headerWritten = false;

HazardApp::~HazardApp()
{
    // This is the fix for the "!event->isStale()" ASSERT at csimulation.cc:571:
    // stateLogTimer runs on every vehicle continuously, and beaconTimer/brakeTimer
    // can still be scheduled at the moment Veins deletes this module (a vehicle
    // reaching the end of its SUMO route and being removed via TraCI, mid-run —
    // finish() does NOT run for that case, only the destructor does). Any of
    // these three left in the FES when the module is destroyed becomes a stale
    // event the next time the kernel tries to deliver it.
    cancelAndDelete(brakeTimer);
    cancelAndDelete(beaconTimer);
    cancelAndDelete(stateLogTimer);
}

void HazardApp::initialize(int stage)
{
    DemoBaseApplLayer::initialize(stage);
    if (stage != 0) return;

    warningSent = false;
    alreadyRelayed = false;
    role = Role::UNKNOWN;

    logFilePath = par("logFile").stdstringValue();
    scenarioId = par("scenarioId").intValue();
    turnSpeedThreshold = par("turnSpeedThreshold").doubleValue();
    waitTimeThreshold = par("waitTimeThreshold").doubleValue();

    chainLength = par("chainLength").intValue();
    brakeTriggerTime = par("brakeTriggerTime").doubleValue();
    brakeTargetSpeed = par("brakeTargetSpeed").doubleValue();
    brakeDuration = par("brakeDuration").doubleValue();

    intersectionCenterX = par("intersectionCenterX").doubleValue();
    intersectionCenterY = par("intersectionCenterY").doubleValue();
    collisionWindowThreshold = par("collisionWindowThreshold").doubleValue();
    relevantRadius = par("relevantRadius").doubleValue();
    beaconInterval = par("beaconInterval").doubleValue();

    runNumber = par("runNumber").intValue();
    randomSeedUsed = par("randomSeedUsed").intValue();
    initialGapM = par("initialGapM").doubleValue();
    carASpeedInit = par("carASpeedInit").doubleValue();
    carBSpeedInit = par("carBSpeedInit").doubleValue();

    // ---- role assignment ----
    // Scenario 2 IDs are checked first (exact match, "carA"/"carB"). Anything
    // else matching "car<N>" is treated as a Scenario 3 chain position: car1 is
    // the leader, car<chainLength> is the tail, everything between is a relay.
    std::string myId = mobility->getExternalId();
    if (myId == "carA") {
        role = Role::EGO_TURN;
    }
    else if (myId == "carB") {
        role = Role::FOLLOWER;
    }
    else if (myId == "carX" || myId == "carY") {
        role = Role::INTERSECTION;
    }
    else if (myId == "carD") {
        role = Role::MERGE_TARGET;
    }
    else if (myId == "truckR") {
        role = Role::TRUCK_RELAY;
    }
    else if (myId == "carM") {
        role = Role::MERGE_EGO;
    }
    else if (myId.rfind("car", 0) == 0 && myId.size() > 3 && std::isdigit(static_cast<unsigned char>(myId[3]))) {
        int n = std::atoi(myId.c_str() + 3);
        if (n == 1) {
            role = Role::BRAKE_LEADER;
        }
        else if (n == chainLength) {
            role = Role::TAIL;
        }
        else {
            role = Role::RELAY;
        }
    }

    if (role == Role::BRAKE_LEADER) {
        brakeTimer = new cMessage("brakeTimer");
        scheduleAt(simTime() + brakeTriggerTime, brakeTimer);
    }

    if (role == Role::INTERSECTION || role == Role::MERGE_TARGET) {
        beaconTimer = new cMessage("beaconTimer");
        scheduleAt(simTime() + beaconInterval, beaconTimer);
    }

    // Dashboard: tag events with a readable scenario name and start this
    // vehicle's position tick. Every HazardApp instance calls setScenario();
    // harmless since it's the same value for all vehicles in one run.
    switch (scenarioId) {
        case 2: EventLogger::instance().setScenario("uturn"); break;
        case 3: EventLogger::instance().setScenario("braking_relay"); break;
        case 4: EventLogger::instance().setScenario("blind_intersection"); break;
        case 5: EventLogger::instance().setScenario("lane_merge"); break;
        default: EventLogger::instance().setScenario("unknown"); break;
    }
    stateLogTimer = new cMessage("stateLogTimer");
    scheduleAt(simTime() + kStateLogIntervalSec, stateLogTimer);

    if (!headerWritten) {
        // Batch mode: each run of the whole scenario is a SEPARATE process (see
        // run_batch*.ps1), so a per-process flag alone can't tell us whether the
        // header was already written by an EARLIER run. Check the file on disk
        // instead: only write the header if the file doesn't exist yet or is
        // currently empty. Never truncate — every run must ADD to the same
        // growing dataset, not overwrite it.
        bool needHeader = true;
        {
            std::ifstream existing(logFilePath, std::ios::in);
            if (existing.good()) {
                existing.seekg(0, std::ios::end);
                needHeader = (existing.tellg() == 0);
            }
        }

        logStream.open(logFilePath, std::ios::out | std::ios::app);
        if (!logStream.is_open()) {
            throw cRuntimeError("HazardApp: could not open log file '%s' for appending — does the containing directory exist?", logFilePath.c_str());
        }
        if (needHeader) {
            logStream << "scenario_id,run_number,random_seed,sim_time,follower_id,follower_speed,sender_speed,"
                         "distance,relative_speed,ttc,hop_count,message_age_ms,"
                         "initial_gap_m,car_a_speed_init,car_b_speed_init,label\n";
            logStream.flush();
        }
        headerWritten = true;
    }
}

void HazardApp::finish()
{
    DemoBaseApplLayer::finish();
    if (logStream.is_open()) {
        logStream.flush();
    }
}

void HazardApp::handleSelfMsg(cMessage* msg)
{
    if (msg == brakeTimer) {
        triggerScriptedBrake();
        return;
    }
    if (msg == beaconTimer) {
        sendIntersectionBeacon();
        return;
    }
    if (msg == stateLogTimer) {
        // Real TraCI-derived state — curPosition/mobility are the same
        // members every other method in this file already reads from.
        EventLogger::instance().logVehicleState(
            mobility->getExternalId(),
            curPosition.x, curPosition.y,
            mobility->getSpeed(),
            mobility->getHeading().getRad() * 180.0 / M_PI
        );
        scheduleAt(simTime() + kStateLogIntervalSec, stateLogTimer);
        return;
    }
    DemoBaseApplLayer::handleSelfMsg(msg);
}

void HazardApp::handlePositionUpdate(cObject* obj)
{
    DemoBaseApplLayer::handlePositionUpdate(obj);

    if (role == Role::EGO_TURN && !warningSent) {
        if (mobility->getSpeed() < turnSpeedThreshold) {
            sendTurnWarning();
            warningSent = true;
        }
    }
}

void HazardApp::sendTurnWarning()
{
    auto* wsm = new HazardMessage();
    populateWSM(wsm);

    wsm->setSenderId(mobility->getExternalId().c_str());
    wsm->setSenderRole("car_turning");
    wsm->setOriginId(mobility->getExternalId().c_str());
    wsm->setEventType("TURN_WARNING");
    wsm->setPosX(curPosition.x);
    wsm->setPosY(curPosition.y);
    wsm->setSpeed(mobility->getSpeed());
    wsm->setHeading(mobility->getHeading().getRad());
    wsm->setHopCount(1);
    wsm->setOriginTimestamp(simTime());

    findHost()->getDisplayString().setTagArg("i", 1, "orange");
    sendDown(wsm);

    EventLogger::instance().logPacketTx(
        makePacketId(wsm->getOriginId(), wsm->getEventType(), wsm->getOriginTimestamp().dbl()),
        mobility->getExternalId(),
        "TURN_WARNING"
    );
}

void HazardApp::triggerScriptedBrake()
{
    // Command the actual SUMO-level deceleration via TraCI, verified against
    // TraCICommandInterface::Vehicle::slowDown(speed, time).
    if (traciVehicle) {
        traciVehicle->slowDown(brakeTargetSpeed, brakeDuration);
    }

    auto* wsm = new HazardMessage();
    populateWSM(wsm);

    wsm->setSenderId(mobility->getExternalId().c_str());
    wsm->setSenderRole("brake_leader");
    wsm->setOriginId(mobility->getExternalId().c_str());
    wsm->setEventType("BRAKE_WARNING");
    wsm->setPosX(curPosition.x);
    wsm->setPosY(curPosition.y);
    wsm->setSpeed(mobility->getSpeed()); // speed at the instant braking begins
    wsm->setHeading(mobility->getHeading().getRad());
    wsm->setHopCount(1);
    wsm->setOriginTimestamp(simTime());

    findHost()->getDisplayString().setTagArg("i", 1, "red");
    sendDown(wsm);

    EventLogger::instance().logPacketTx(
        makePacketId(wsm->getOriginId(), wsm->getEventType(), wsm->getOriginTimestamp().dbl()),
        mobility->getExternalId(),
        "BRAKE_WARNING"
    );
}

void HazardApp::sendIntersectionBeacon()
{
    auto* wsm = new HazardMessage();
    populateWSM(wsm);

    bool isMergeTarget = (role == Role::MERGE_TARGET);

    wsm->setSenderId(mobility->getExternalId().c_str());
    wsm->setSenderRole(isMergeTarget ? "merge_target" : "intersection_vehicle");
    wsm->setOriginId(mobility->getExternalId().c_str());
    wsm->setEventType(isMergeTarget ? "MERGE_STATUS" : "INTERSECTION_STATUS");
    wsm->setPosX(curPosition.x);
    wsm->setPosY(curPosition.y);
    wsm->setSpeed(mobility->getSpeed());
    wsm->setHeading(mobility->getHeading().getRad());
    wsm->setHopCount(1);
    wsm->setOriginTimestamp(simTime());
    sendDown(wsm);

    EventLogger::instance().logPacketTx(
        makePacketId(wsm->getOriginId(), wsm->getEventType(), wsm->getOriginTimestamp().dbl()),
        mobility->getExternalId(),
        isMergeTarget ? "MERGE_STATUS" : "INTERSECTION_STATUS"
    );

    // continuous beaconing: reschedule ourselves for the next interval
    scheduleAt(simTime() + beaconInterval, beaconTimer);
}

void HazardApp::onWSM(BaseFrame1609_4* frame)
{
    auto* wsm = check_and_cast<HazardMessage*>(frame);

    {
        // distance here matches what evaluateAndLog() computes: it's distance
        // to the position CARRIED in the message (the original hazard's
        // position on a relay, not the immediate relay hop's own position) —
        // same quantity, so the dashboard's numbers line up with the CSV's.
        double dx = curPosition.x - wsm->getPosX();
        double dy = curPosition.y - wsm->getPosY();
        double distanceM = std::sqrt(dx * dx + dy * dy);
        double delayMs = (simTime().dbl() - wsm->getOriginTimestamp().dbl()) * 1000.0;
        EventLogger::instance().logPacketRx(
            makePacketId(wsm->getOriginId(), wsm->getEventType(), wsm->getOriginTimestamp().dbl()),
            wsm->getSenderId(),
            mobility->getExternalId(),
            delayMs,
            distanceM
        );
    }

    if (role == Role::FOLLOWER && strcmp(wsm->getEventType(), "TURN_WARNING") == 0) {
        // "WAIT_TURNING" preserved exactly as-is — this is the label already
        // written into results/scenario2_dataset.csv from tonight's earlier runs;
        // changing it would make the growing dataset inconsistent with itself.
        evaluateAndLog(wsm->getPosX(), wsm->getPosY(), wsm->getSpeed(), wsm->getOriginTimestamp().dbl(), wsm->getHopCount(), "WAIT_TURNING");
        return;
    }

    if ((role == Role::RELAY || role == Role::TAIL) && strcmp(wsm->getEventType(), "BRAKE_WARNING") == 0) {
        evaluateAndLog(wsm->getPosX(), wsm->getPosY(), wsm->getSpeed(), wsm->getOriginTimestamp().dbl(), wsm->getHopCount(), "WAIT_BRAKE");

        if (role == Role::RELAY && !alreadyRelayed) {
            relayBrakeWarning(wsm);
            alreadyRelayed = true;
        }
        return;
    }

    if (role == Role::INTERSECTION && strcmp(wsm->getEventType(), "INTERSECTION_STATUS") == 0) {
        evaluateIntersectionAndLog(wsm->getPosX(), wsm->getPosY(), wsm->getSpeed(), wsm->getOriginTimestamp().dbl(), "WAIT_INTERSECTION");
        return;
    }

    if (role == Role::TRUCK_RELAY && strcmp(wsm->getEventType(), "MERGE_STATUS") == 0) {
        // The truck itself never decides — it only forwards carD's status to
        // whoever is behind it (carM). It relays every beacon it hears; no
        // "already relayed" guard needed since each beacon is a fresh message
        // and there's only one relay hop in this topology (no loop risk).
        relayMergeStatus(wsm);
        return;
    }

    if (role == Role::MERGE_EGO && strcmp(wsm->getEventType(), "MERGE_STATUS") == 0) {
        // Deliberately gated: only act on messages explicitly tagged as
        // relayed by the truck. This is the logical stand-in for "carM can't
        // see carD directly because truckR is in the way" — see the class
        // comment and scenario 5's README for why this isn't modeled as real
        // radio LOS-blocking.
        if (strcmp(wsm->getSenderRole(), "relay_truck") == 0) {
            evaluateIntersectionAndLog(wsm->getPosX(), wsm->getPosY(), wsm->getSpeed(), wsm->getOriginTimestamp().dbl(), "WAIT_TO_MERGE");
        }
        return;
    }
}

void HazardApp::relayBrakeWarning(HazardMessage* received)
{
    // Forward the ORIGINAL hazard's position/speed/timestamp, not our own —
    // this is deliberate: it's what lets hop_count and message_age_ms measure
    // the true propagation-speed advantage of V2V relay all the way back to
    // the original braking event, which is the metric this scenario exists
    // to capture (see design doc: communication-latency-advantage metric).
    auto* wsm = new HazardMessage();
    populateWSM(wsm);

    wsm->setSenderId(mobility->getExternalId().c_str());
    wsm->setSenderRole("relay");
    wsm->setOriginId(received->getOriginId());
    wsm->setEventType("BRAKE_WARNING");
    wsm->setPosX(received->getPosX());
    wsm->setPosY(received->getPosY());
    wsm->setSpeed(received->getSpeed());
    wsm->setHeading(received->getHeading());
    wsm->setHopCount(received->getHopCount() + 1);
    wsm->setOriginTimestamp(received->getOriginTimestamp());

    findHost()->getDisplayString().setTagArg("i", 1, "orange");
    sendDown(wsm);

    EventLogger::instance().logPacketRelay(
        makePacketId(wsm->getOriginId(), wsm->getEventType(), wsm->getOriginTimestamp().dbl()),
        mobility->getExternalId(),
        wsm->getOriginId(),
        wsm->getHopCount()
    );
}

void HazardApp::relayMergeStatus(HazardMessage* received)
{
    // Same principle as relayBrakeWarning: forward carD's ORIGINAL
    // position/speed/timestamp, not the truck's own — carM's ETA comparison
    // needs to be against carD's real state, not the truck's.
    auto* wsm = new HazardMessage();
    populateWSM(wsm);

    wsm->setSenderId(mobility->getExternalId().c_str());
    wsm->setSenderRole("relay_truck");
    wsm->setOriginId(received->getOriginId());
    wsm->setEventType("MERGE_STATUS");
    wsm->setPosX(received->getPosX());
    wsm->setPosY(received->getPosY());
    wsm->setSpeed(received->getSpeed());
    wsm->setHeading(received->getHeading());
    wsm->setHopCount(received->getHopCount() + 1);
    wsm->setOriginTimestamp(received->getOriginTimestamp());

    findHost()->getDisplayString().setTagArg("i", 1, "orange");
    sendDown(wsm);

    EventLogger::instance().logPacketRelay(
        makePacketId(wsm->getOriginId(), wsm->getEventType(), wsm->getOriginTimestamp().dbl()),
        mobility->getExternalId(),
        wsm->getOriginId(),
        wsm->getHopCount()
    );
}

void HazardApp::evaluateAndLog(double senderPosX, double senderPosY, double senderSpeed, double originTimestampSec, int hopCount, const std::string& waitLabel)
{
    double dx = curPosition.x - senderPosX;
    double dy = curPosition.y - senderPosY;
    double distance = std::sqrt(dx * dx + dy * dy);

    double mySpeed = mobility->getSpeed();
    double relativeSpeed = mySpeed - senderSpeed; // positive = closing in

    // time-to-close-the-gap, only meaningful while actually closing
    double ttc = (relativeSpeed > 0.1) ? (distance / relativeSpeed) : 9999.0;

    double messageAgeMs = (simTime().dbl() - originTimestampSec) * 1000.0;

    std::string label = (ttc < waitTimeThreshold) ? waitLabel : "SAFE";

    findHost()->getDisplayString().setTagArg("i", 1, label == "SAFE" ? "green" : "red");

    logDecision(label, distance, relativeSpeed, ttc, hopCount, messageAgeMs);
}

void HazardApp::evaluateIntersectionAndLog(double peerPosX, double peerPosY, double peerSpeed, double originTimestampSec, const std::string& waitLabel)
{
    // Different geometry from evaluateAndLog: the two vehicles approach a
    // shared point from DIFFERENT directions (perpendicular roads for
    // Scenario 4, converging lanes for Scenario 5's merge point), so raw
    // distance-between-them doesn't indicate collision risk — what matters is
    // whether they'll reach the shared point at close to the same time. So:
    // compute each vehicle's own straight-line distance-to-point and divide
    // by its own speed to estimate ETA, then compare the two ETAs.
    double myDx = curPosition.x - intersectionCenterX;
    double myDy = curPosition.y - intersectionCenterY;
    double myDistToCenter = std::sqrt(myDx * myDx + myDy * myDy);

    // Only evaluate/log once we're actually near the shared point — far away,
    // an ETA-based comparison is noisy and not yet decision-relevant.
    if (myDistToCenter > relevantRadius) return;

    double peerDx = peerPosX - intersectionCenterX;
    double peerDy = peerPosY - intersectionCenterY;
    double peerDistToCenter = std::sqrt(peerDx * peerDx + peerDy * peerDy);

    double mySpeed = mobility->getSpeed();
    double myEta = (mySpeed > 0.1) ? (myDistToCenter / mySpeed) : 9999.0;
    double peerEta = (peerSpeed > 0.1) ? (peerDistToCenter / peerSpeed) : 9999.0;

    double etaGap = std::fabs(myEta - peerEta);

    double messageAgeMs = (simTime().dbl() - originTimestampSec) * 1000.0;

    std::string label = (etaGap < collisionWindowThreshold) ? waitLabel : "SAFE";

    findHost()->getDisplayString().setTagArg("i", 1, label == "SAFE" ? "green" : "red");

    // Reusing the shared CSV schema: "distance" and "relative_speed" here are
    // literal car-to-car values (still informative), while "ttc" is
    // repurposed as the ETA gap at the shared point — the actual quantity
    // this scenario's decision is based on. Documented in each scenario's
    // README so this isn't a silent redefinition.
    double directDistance = std::sqrt(std::pow(curPosition.x - peerPosX, 2) + std::pow(curPosition.y - peerPosY, 2));
    double relativeSpeed = mySpeed - peerSpeed;

    logDecision(label, directDistance, relativeSpeed, etaGap, 1, messageAgeMs);
}

void HazardApp::logDecision(const std::string& label, double distance, double relativeSpeed, double ttc, int hopCount, double messageAgeMs)
{
    // Dashboard event — independent of whether the CSV stream is open, so a
    // logging hiccup on one side never silently drops the other.
    EventLogger::instance().logDecision(mobility->getExternalId(), label, ttc, distance, relativeSpeed);

    if (!logStream.is_open()) return;

    logStream << scenarioId << ","
              << runNumber << ","
              << randomSeedUsed << ","
              << simTime().dbl() << ","
              << mobility->getExternalId() << ","
              << mobility->getSpeed() << ","
              << (mobility->getSpeed() - relativeSpeed) << ","
              << distance << ","
              << relativeSpeed << ","
              << ttc << ","
              << hopCount << ","
              << messageAgeMs << ","
              << initialGapM << ","
              << carASpeedInit << ","
              << carBSpeedInit << ","
              << label << "\n";
    logStream.flush();
}
