import { Box, Radar } from 'lucide-react';
import { AnalysisBar } from './analysis-bar/AnalysisBar';
import { STANDBY_SITUATION } from './analysis-bar/situation';
import { Panel } from './components/Panel';
import { TooltipProvider } from './components/Tooltip';
import { Footer, TimelineBar } from './layout/ChromeBars';
import { ThreatPalette } from './palette/ThreatPalette';
import {
  EventLogPanel,
  InspectorPanel,
  TelemetryPanel,
  TrackTablePanel,
} from './panels/ConsolePanels';
import { BattlespacePreview } from './views/BattlespacePreview';
import { RadarScopePreview } from './views/RadarScopePreview';

export function App() {
  return (
    <TooltipProvider delayDuration={200} skipDelayDuration={100}>
      <div className="flex min-h-dvh flex-col lg:h-dvh">
        <AnalysisBar situation={STANDBY_SITUATION} />
        <main className="console-grid min-h-0 flex-1 p-2 lg:overflow-auto">
          <ThreatPalette className="area-palette" />
          <Panel title="3D battlespace" icon={Box} step={2} className="area-view">
            <BattlespacePreview />
          </Panel>
          <Panel title="Sensor scope" icon={Radar} step={1} className="area-scope">
            <RadarScopePreview />
          </Panel>
          <TrackTablePanel className="area-tracks" />
          <div className="area-bottom bottom-grid">
            <InspectorPanel />
            <TelemetryPanel />
            <EventLogPanel />
          </div>
          <TimelineBar situation={STANDBY_SITUATION} className="area-timeline" />
        </main>
        <Footer />
      </div>
    </TooltipProvider>
  );
}
