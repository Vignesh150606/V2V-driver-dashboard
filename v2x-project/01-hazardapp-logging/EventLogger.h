// EventLogger.h
//
// Drop this file (and EventLogger.cc) into:
//   src/veins/modules/application/traci/
// alongside HazardApp.cc/.h, then rebuild your Veins project as usual.
//
// Purpose: every time HazardApp already computes something real (a position
// update, a broadcast, a relay, a SAFE/WAIT_* decision), call one line here.
// That line appends a JSON event to a run-scoped .jsonl log file. Nothing in
// this class invents data -- it only serializes values you pass in.
//
// The bridge server (part 2) tails this file and pushes each line to the
// dashboard over WebSocket in real time.

#ifndef HAZARDAPP_EVENTLOGGER_H
#define HAZARDAPP_EVENTLOGGER_H

#include <fstream>
#include <string>

namespace veins {

class EventLogger {
public:
    // Singleton: one shared log file per simulation process (per run),
    // written to by every vehicle's HazardApp instance.
    static EventLogger& instance();

    // Call once, e.g. in the first HazardApp::initialize(), so every event
    // in this run is tagged with which scenario produced it.
    void setScenario(const std::string& scenario);

    // --- Call these at the points HazardApp already computes the values ---

    // Periodic ground-truth position, from TraCIMobility -- not invented.
    void logVehicleState(const std::string& vehicleId, double x, double y,
                          double speedMps, double headingDeg,
                          const std::string& roadId = "");

    // Call where HazardApp broadcasts a warning (e.g. sendDown(wsm)).
    void logPacketTx(const std::string& packetId, const std::string& senderId,
                      const std::string& msgType);

    // Call in the receive handler (e.g. onWSM / handleLowerMsg).
    void logPacketRx(const std::string& packetId, const std::string& senderId,
                      const std::string& receiverId, double delayMs,
                      double distanceM);

    // Call at the relay branch (Scenario 3 / Scenario 5).
    void logPacketRelay(const std::string& packetId, const std::string& relayId,
                         const std::string& originalSenderId, int hopCount);

    // Call right where you currently write a CSV row -- reuse the same
    // ttc/distance/relativeSpeed variables you already have.
    void logDecision(const std::string& vehicleId, const std::string& decision,
                      double ttc, double distanceM, double relativeSpeedMps,
                      const std::string& relatedPacketId = "");

private:
    EventLogger();
    ~EventLogger();
    EventLogger(const EventLogger&) = delete;
    EventLogger& operator=(const EventLogger&) = delete;

    void writeEvent(const std::string& type, const std::string& payloadJson);
    static std::string jsonEscape(const std::string& s);
    static std::string resolveRunId();
    static std::string resolveOutDir();

    std::ofstream out_;
    std::string runId_;
    std::string scenario_;
};

} // namespace veins

#endif // HAZARDAPP_EVENTLOGGER_H
