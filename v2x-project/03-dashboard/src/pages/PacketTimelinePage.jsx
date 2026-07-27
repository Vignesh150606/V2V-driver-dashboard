import { useEventStore } from '../store/useEventStore.jsx';

const KIND_STYLE = {
  tx: { label: 'TX', color: 'text-teal' },
  rx: { label: 'RX', color: 'text-blue' },
  relay: { label: 'RELAY', color: 'text-amber' },
  unknown: { label: '?', color: 'text-ink3' },
};

export default function PacketTimelinePage() {
  const { packets } = useEventStore();

  return (
    <div className="p-6">
      <div className="text-xs text-ink2 uppercase tracking-wide mb-3">
        Packet timeline — most recent first, {packets.length} buffered
      </div>
      <div className="border border-line bg-panel rounded-lg overflow-hidden">
        <table className="w-full text-sm font-mono">
          <thead>
            <tr className="text-ink2 text-xs border-b border-line">
              <th className="text-left px-4 py-2 font-normal">sim time</th>
              <th className="text-left px-4 py-2 font-normal">event</th>
              <th className="text-left px-4 py-2 font-normal">packet id</th>
              <th className="text-left px-4 py-2 font-normal">from</th>
              <th className="text-left px-4 py-2 font-normal">to</th>
              <th className="text-left px-4 py-2 font-normal">detail</th>
            </tr>
          </thead>
          <tbody>
            {packets.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink3">
                  waiting for packet events…
                </td>
              </tr>
            )}
            {packets.map((p) => {
              const style = KIND_STYLE[p.kind] || KIND_STYLE.unknown;
              return (
                <tr key={p.key} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-2 text-ink2">{p.timestamp_sim?.toFixed(2)}</td>
                  <td className={`px-4 py-2 ${style.color}`}>{style.label}</td>
                  <td className="px-4 py-2 text-ink3">{p.packet_id}</td>
                  <td className="px-4 py-2 text-ink">{p.sender_id || p.relay_id || '—'}</td>
                  <td className="px-4 py-2 text-ink">{p.receiver_id || '—'}</td>
                  <td className="px-4 py-2 text-ink2">
                    {p.kind === 'rx' && `${p.delay_ms?.toFixed(1)} ms · ${p.distance_m?.toFixed(1)} m`}
                    {p.kind === 'relay' && `hop ${p.hop_count} · from ${p.original_sender_id}`}
                    {p.kind === 'tx' && p.msg_type}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
