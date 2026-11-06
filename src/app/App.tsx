import { Box, Radar } from 'lucide-react';
import { AnalysisBar } from './analysis-bar/AnalysisBar';
import { useLiveSituation } from './analysis-bar/useLiveSituation';
import { ConceptPopover } from './components/ConceptPopover';
import { Panel } from './components/Panel';
import { TooltipProvider } from './components/Tooltip';
import { Footer } from './layout/ChromeBars';
import { PlayerBar } from './layout/PlayerBar';
import { ThreatPalette } from './palette/ThreatPalette';
import {
  EventLogPanel,
  InspectorPanel,
  TelemetryPanel,
  TrackTablePanel,
} from './panels/ConsolePanels';
import { SimProvider } from './sim/SimProvider';
import { BattlespacePreview } from './views/BattlespacePreview';
import { RadarScope } from './views/RadarScope';

export function App() {
  return (
    <TooltipProvider delayDuration={200} skipDelayDuration={100}>
      <SimProvider>
        <Console />
      </SimProvider>
    </TooltipProvider>
  );
}

function Console() {
  const situation = useLiveSituation();
  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <AnalysisBar situation={situation} />
      <main className="console-grid min-h-0 flex-1 p-2 lg:overflow-auto">
        <ThreatPalette className="area-palette" />
        <Panel title="3D battlespace" icon={Box} step={2} className="area-view">
          <BattlespacePreview />
        </Panel>
        <Panel
          title="Sensor scope"
          icon={Radar}
          panelId="scope"
          className="area-scope"
          bodyClassName="flex flex-col items-center gap-2 p-3"
          actions={
            <ConceptPopover
              concept="antennaRotation"
              label="Why radar blips jump instead of gliding"
            />
          }
        >
          <RadarScope />
          <p className="text-center text-[11px] leading-snug text-ink-300">
            Search radar · one turn every 4 s · rings every 10 km
          </p>
        </Panel>
        <TrackTablePanel className="area-tracks" />
        <div className="area-bottom bottom-grid">
          <InspectorPanel />
          <TelemetryPanel />
          <EventLogPanel />
        </div>
        <PlayerBar className="area-timeline" />
      </main>
      <Footer />
    </div>
  );
}
