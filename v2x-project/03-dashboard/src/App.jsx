import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar.jsx';
import TopBar from './components/TopBar.jsx';
import { EventStoreProvider } from './store/useEventStore.jsx';

import DashboardPage from './pages/DashboardPage.jsx';
import LiveSimulationPage from './pages/LiveSimulationPage.jsx';
import PacketTimelinePage from './pages/PacketTimelinePage.jsx';
import VehicleInspectorPage from './pages/VehicleInspectorPage.jsx';
import NetworkGraphPage from './pages/NetworkGraphPage.jsx';
import DatasetGeneratorPage from './pages/DatasetGeneratorPage.jsx';
import AnalyticsPage from './pages/AnalyticsPage.jsx';
import ReplayPage from './pages/ReplayPage.jsx';

const TITLES = {
  '/': 'Dashboard',
  '/live': 'Live simulation',
  '/timeline': 'Packet timeline',
  '/inspector': 'Vehicle inspector',
  '/network': 'Network graph',
  '/dataset': 'Dataset generator',
  '/analytics': 'Analytics',
  '/replay': 'Replay previous runs',
};

function Shell() {
  const location = useLocation();
  const title = TITLES[location.pathname] || 'V2X console';

  return (
    <div className="flex h-screen bg-base text-ink">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar title={title} />
        <div className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/live" element={<LiveSimulationPage />} />
            <Route path="/timeline" element={<PacketTimelinePage />} />
            <Route path="/inspector" element={<VehicleInspectorPage />} />
            <Route path="/network" element={<NetworkGraphPage />} />
            <Route path="/dataset" element={<DatasetGeneratorPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/replay" element={<ReplayPage />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <EventStoreProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </EventStoreProvider>
  );
}
