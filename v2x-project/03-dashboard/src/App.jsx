import { HashRouter, Routes, Route, Outlet, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar.jsx';
import TopBar from './components/TopBar.jsx';
import { EventStoreProvider } from './store/useEventStore.jsx';

import LandingPage from './pages/LandingPage.jsx';
import DriverView from './pages/DriverView.jsx';

import DashboardPage from './pages/DashboardPage.jsx';
import LiveSimulationPage from './pages/LiveSimulationPage.jsx';
import PacketTimelinePage from './pages/PacketTimelinePage.jsx';
import VehicleInspectorPage from './pages/VehicleInspectorPage.jsx';
import NetworkGraphPage from './pages/NetworkGraphPage.jsx';
import DatasetGeneratorPage from './pages/DatasetGeneratorPage.jsx';
import AnalyticsPage from './pages/AnalyticsPage.jsx';
import ReplayPage from './pages/ReplayPage.jsx';

const TITLES = {
  '/dashboard': 'Dashboard',
  '/dashboard/live': 'Live simulation',
  '/dashboard/timeline': 'Packet timeline',
  '/dashboard/inspector': 'Vehicle inspector',
  '/dashboard/network': 'Network graph',
  '/dashboard/dataset': 'Dataset generator',
  '/dashboard/analytics': 'Analytics',
  '/dashboard/replay': 'Replay previous runs',
};

// The Engineering Dashboard shell -- sidebar + top bar + an <Outlet/> for
// whichever child route matched. This is React Router v6's standard
// nested-route pattern (Route with children + Outlet), not a second
// independent Routes tree -- used here specifically to remove any doubt
// about routing behavior while debugging.
function EngineeringShell() {
  const location = useLocation();
  const title = TITLES[location.pathname] || 'V2X console';

  return (
    <div className="flex h-screen bg-base text-ink">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar title={title} />
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <EventStoreProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/driver" element={<DriverView />} />
          <Route path="/dashboard" element={<EngineeringShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="live" element={<LiveSimulationPage />} />
            <Route path="timeline" element={<PacketTimelinePage />} />
            <Route path="inspector" element={<VehicleInspectorPage />} />
            <Route path="network" element={<NetworkGraphPage />} />
            <Route path="dataset" element={<DatasetGeneratorPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="replay" element={<ReplayPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </EventStoreProvider>
  );
}
