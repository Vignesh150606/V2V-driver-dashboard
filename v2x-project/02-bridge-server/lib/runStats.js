import fs from 'fs';

// Computes real run statistics directly from the recorded event stream --
// nothing here is estimated or invented, it's a single pass over what
// HazardApp actually wrote. Shared so the run list and any future endpoint
// (export, analytics) compute stats identically instead of duplicating
// this logic.
export function computeRunStats(filePath) {
  const stat = fs.statSync(filePath);
  const lines = fs.readFileSync(filePath, 'utf8').trim().split('\n').filter(Boolean);

  let scenario = 'unknown';
  const vehicleIds = new Set();
  let decisionCount = 0;
  let warningCount = 0;
  let packetCount = 0;
  let minT = Infinity;
  let maxT = -Infinity;

  for (const line of lines) {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue; // skip malformed lines rather than fail the whole run
    }
    if (event.scenario) scenario = event.scenario;
    if (typeof event.timestamp_sim === 'number') {
      minT = Math.min(minT, event.timestamp_sim);
      maxT = Math.max(maxT, event.timestamp_sim);
    }

    const p = event.payload || {};
    switch (event.type) {
      case 'vehicle_state':
        if (p.vehicle_id) vehicleIds.add(p.vehicle_id);
        break;
      case 'decision':
        decisionCount += 1;
        if (p.vehicle_id) vehicleIds.add(p.vehicle_id);
        if (p.decision && p.decision !== 'SAFE') warningCount += 1;
        break;
      case 'packet_tx':
      case 'packet_rx':
      case 'packet_relay':
        packetCount += 1;
        break;
      default:
        break;
    }
  }

  return {
    run_id: filePath.split(/[\\/]/).pop().replace('.jsonl', ''),
    scenario,
    event_count: lines.length,
    vehicle_count: vehicleIds.size,
    decision_count: decisionCount,
    packet_count: packetCount,
    warning_count: warningCount,
    duration_sim: Number.isFinite(minT) && Number.isFinite(maxT) ? Math.max(maxT - minT, 0) : 0,
    updated_at: stat.mtime,
  };
}
