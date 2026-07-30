import { useEffect, useState } from 'react';
import { useEventStore } from '../store/useEventStore.jsx';
import VehicleMap from '../components/VehicleMap.jsx';

export default function LiveSimulationPage() {
  const { vehicles, packets } = useEventStore();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);

  const list = Object.values(vehicles);

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center gap-4 mb-3 text-xs font-mono text-ink2">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-teal" /> SAFE
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber" /> CAUTION_*
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red" /> WAIT_*
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-ink3" /> no decision yet
        </span>
        <span className="ml-auto">{list.length} vehicle{list.length === 1 ? '' : 's'} tracked</span>
      </div>
      <div className="flex-1 min-h-[420px]">
        <VehicleMap vehicles={vehicles} packets={packets} now={now} />
      </div>
    </div>
  );
}
