// EventLogger.cc
#include "EventLogger.h"

#include <cstdlib>
#include <cstring>
#include <ctime>
#include <sstream>
#include <sys/stat.h>
#include <omnetpp.h>

namespace veins {

EventLogger& EventLogger::instance()
{
    static EventLogger inst;
    return inst;
}

std::string EventLogger::resolveRunId()
{
    // Your PowerShell batch script should set HAZARD_RUN_ID before each run
    // (e.g. "run_2026-07-25_003") so the dashboard's run list is meaningful.
    // If it isn't set (manual Cmdenv run), fall back to a timestamp so runs
    // never collide.
    const char* envRunId = std::getenv("HAZARD_RUN_ID");
    if (envRunId && std::strlen(envRunId) > 0) {
        return std::string(envRunId);
    }
    std::time_t t = std::time(nullptr);
    std::ostringstream oss;
    oss << "run_" << static_cast<long long>(t);
    return oss.str();
}

std::string EventLogger::resolveOutDir()
{
    const char* envDir = std::getenv("HAZARD_LOG_DIR");
    if (envDir && std::strlen(envDir) > 0) {
        return std::string(envDir);
    }
    return std::string("results/live");
}

EventLogger::EventLogger()
{
    runId_ = resolveRunId();
    std::string dir = resolveOutDir();

#if defined(_WIN32)
    std::string cmd = "if not exist \"" + dir + "\" mkdir \"" + dir + "\"";
    std::system(cmd.c_str());
#else
    mkdir(dir.c_str(), 0755);
#endif

    std::string path = dir + "/" + runId_ + ".jsonl";
    out_.open(path, std::ios::out | std::ios::app);
    if (!out_.is_open()) {
        // Don't crash the simulation over a logging problem -- just warn.
        EV_WARN << "EventLogger: could not open " << path
                << " -- live dashboard events will not be recorded for this run\n";
    }
}

EventLogger::~EventLogger()
{
    if (out_.is_open()) {
        out_.close();
    }
}

void EventLogger::setScenario(const std::string& scenario)
{
    scenario_ = scenario;
}

std::string EventLogger::jsonEscape(const std::string& s)
{
    std::string r;
    r.reserve(s.size());
    for (char c : s) {
        if (c == '"' || c == '\\') {
            r += '\\';
        }
        r += c;
    }
    return r;
}

void EventLogger::writeEvent(const std::string& type, const std::string& payloadJson)
{
    if (!out_.is_open()) {
        return;
    }
    out_ << "{"
         << "\"schema_version\":\"1.0\","
         << "\"run_id\":\"" << jsonEscape(runId_) << "\","
         << "\"scenario\":\"" << jsonEscape(scenario_) << "\","
         << "\"source\":\"simulation\","
         << "\"timestamp_sim\":" << omnetpp::simTime().dbl() << ","
         << "\"type\":\"" << type << "\","
         << "\"payload\":" << payloadJson
         << "}\n";
    out_.flush(); // flush per line -- this is what makes the dashboard "live"
}

void EventLogger::logVehicleState(const std::string& vehicleId, double x, double y,
                                   double speedMps, double headingDeg,
                                   const std::string& roadId)
{
    std::ostringstream p;
    p << "{"
      << "\"vehicle_id\":\"" << jsonEscape(vehicleId) << "\","
      << "\"x\":" << x << ","
      << "\"y\":" << y << ","
      << "\"speed\":" << speedMps << ","
      << "\"heading\":" << headingDeg << ","
      << "\"road_id\":\"" << jsonEscape(roadId) << "\""
      << "}";
    writeEvent("vehicle_state", p.str());
}

void EventLogger::logPacketTx(const std::string& packetId, const std::string& senderId,
                               const std::string& msgType)
{
    std::ostringstream p;
    p << "{"
      << "\"packet_id\":\"" << jsonEscape(packetId) << "\","
      << "\"sender_id\":\"" << jsonEscape(senderId) << "\","
      << "\"msg_type\":\"" << jsonEscape(msgType) << "\""
      << "}";
    writeEvent("packet_tx", p.str());
}

void EventLogger::logPacketRx(const std::string& packetId, const std::string& senderId,
                               const std::string& receiverId, double delayMs,
                               double distanceM)
{
    std::ostringstream p;
    p << "{"
      << "\"packet_id\":\"" << jsonEscape(packetId) << "\","
      << "\"sender_id\":\"" << jsonEscape(senderId) << "\","
      << "\"receiver_id\":\"" << jsonEscape(receiverId) << "\","
      << "\"delay_ms\":" << delayMs << ","
      << "\"distance_m\":" << distanceM
      << "}";
    writeEvent("packet_rx", p.str());
}

void EventLogger::logPacketRelay(const std::string& packetId, const std::string& relayId,
                                  const std::string& originalSenderId, int hopCount)
{
    std::ostringstream p;
    p << "{"
      << "\"packet_id\":\"" << jsonEscape(packetId) << "\","
      << "\"relay_id\":\"" << jsonEscape(relayId) << "\","
      << "\"original_sender_id\":\"" << jsonEscape(originalSenderId) << "\","
      << "\"hop_count\":" << hopCount
      << "}";
    writeEvent("packet_relay", p.str());
}

void EventLogger::logDecision(const std::string& vehicleId, const std::string& decision,
                               double ttc, double distanceM, double relativeSpeedMps,
                               const std::string& relatedPacketId)
{
    std::ostringstream p;
    p << "{"
      << "\"vehicle_id\":\"" << jsonEscape(vehicleId) << "\","
      << "\"decision\":\"" << jsonEscape(decision) << "\","
      << "\"ttc\":" << ttc << ","
      << "\"distance_m\":" << distanceM << ","
      << "\"relative_speed\":" << relativeSpeedMps << ","
      << "\"related_packet_id\":\"" << jsonEscape(relatedPacketId) << "\""
      << "}";
    writeEvent("decision", p.str());
}

} // namespace veins
