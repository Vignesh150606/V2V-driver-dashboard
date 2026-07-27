import { memo, useEffect, useRef, useState } from 'react';
import DecisionIcon from './icons.jsx';

// Real msg_type values HazardApp emits, mapped to driver-facing text. Falls
// back generically for any msg_type not yet known, so a new scenario's
// message types still render instead of showing nothing.
const MESSAGE_TEXT = {
  BRAKE_WARNING: 'Vehicle ahead braking',
  TURN_WARNING: 'Vehicle turning ahead',
  MERGE_STATUS: 'Merge status update',
  INTERSECTION_STATUS: 'Intersection status update',
};

function describeMessage(msgType) {
  return MESSAGE_TEXT[msgType] || (msgType ? msgType.replace(/_/g, ' ').toLowerCase() : 'V2X message received');
}

function AlertFeed({ incomingForVehicle }) {
  const [toast, setToast] = useState(null);
  const seenKeys = useRef(new Set());

  useEffect(() => {
    const newest = incomingForVehicle[0];
    if (newest && !seenKeys.current.has(newest.key)) {
      seenKeys.current.add(newest.key);
      setToast(newest);
      const t = setTimeout(() => setToast((cur) => (cur?.key === newest.key ? null : cur)), 3000);
      return () => clearTimeout(t);
    }
  }, [incomingForVehicle]);

  return (
    <div className="w-full max-w-2xl">
      {toast && (
        <div className="driver-toast mb-3 rounded-xl border border-blue-400/40 bg-blue-500/15 backdrop-blur-xl px-4 py-3 flex items-center gap-3">
          <span className="text-blue-300 shrink-0">
            <DecisionIcon name="signal" className="w-6 h-6" />
          </span>
          <div>
            <div className="text-white font-medium">{describeMessage(toast.msg_type)}</div>
            <div className="text-xs text-white/50 font-mono">from {toast.sender_id}</div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl px-4 py-3">
        <div className="text-[11px] uppercase tracking-wide text-white/40 mb-2">Recent Alerts</div>
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {incomingForVehicle.length === 0 && (
            <div className="text-sm text-white/30 py-2">No messages received yet</div>
          )}
          {incomingForVehicle.slice(0, 12).map((m) => (
            <div key={m.key} className="flex items-center justify-between text-sm">
              <span className="text-white/80">{describeMessage(m.msg_type)}</span>
              <span className="text-white/30 font-mono text-xs">
                {m.sender_id} · t={m.timestamp_sim?.toFixed(1)}s
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default memo(AlertFeed);
