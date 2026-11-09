import { Box, Radar } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { AnalysisBar } from './analysis-bar/AnalysisBar';
import { useLiveSituation } from './analysis-bar/useLiveSituation';
import { ConceptPopover } from './components/ConceptPopover';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Panel } from './components/Panel';
import { TooltipProvider } from './components/Tooltip';
import { Footer } from './layout/ChromeBars';
import { PlayerBar } from './layout/PlayerBar';
import { ThreatPalette } from './palette/ThreatPalette';
import { EventLogPanel, TrackTablePanel } from './panels/ConsolePanels';
import { InspectorPanel } from './panels/InspectorPanel';
import { PlacementOverlay } from './placement/PlacementOverlay';
import { SimProvider } from './sim/SimProvider';
import { useSelectionGuard } from './view/useSelectionGuard';
import { useViewShortcuts } from './view/useViewShortcuts';
import { BattlespaceFallback } from './views/BattlespaceFallback';
import { CoverageControl, RadarScope, ScopeLegend } from './views/RadarScope';
import { WindIndicator } from './views/WindIndicator';
import { ApprovalCard } from './views/ApprovalCard';
import { ResultToasts } from './views/ResultToasts';

// three.js is large: load the 3D view in its own chunk, after the console is on screen.
const Battlespace3D = lazy(() => import('./views/3d/Battlespace3D'));

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
  useSelectionGuard();
  useViewShortcuts();
  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <AnalysisBar situation={situation} />
      <main className="console-grid min-h-0 flex-1 p-2 lg:overflow-auto">
        <ThreatPalette className="area-palette" />
        <Panel
          title="3D battlespace"
          icon={Box}
          panelId="battlespace"
          className="area-view h-[min(72svh,34rem)] lg:h-auto"
          bodyClassName="relative"
          actions={
            <ConceptPopover
              concept="localCoordinates"
              label="How the scope and the 3D view share one map"
            />
          }
        >
          <ErrorBoundary fallback={<BattlespaceFallback state="unavailable" />}>
            <Suspense fallback={<BattlespaceFallback state="loading" />}>
              <Battlespace3D />
            </Suspense>
          </ErrorBoundary>
          <ResultToasts />
          <ApprovalCard />
        </Panel>
        <Panel
          title="Sensor scope"
          icon={Radar}
          panelId="scope"
          className="area-scope"
          bodyClassName="flex flex-col items-center gap-2 p-3"
          actions={
            <>
              <WindIndicator />
              <ConceptPopover concept="wind" label="Why a drone crabs sideways in the wind" />
              <ConceptPopover
                concept="antennaRotation"
                label="Why radar blips jump instead of gliding"
              />
            </>
          }
        >
          <RadarScope />
          <CoverageControl />
          <ScopeLegend />
        </Panel>
        <TrackTablePanel className="area-tracks" />
        <div className="area-bottom bottom-grid">
          <InspectorPanel />
          <EventLogPanel />
        </div>
        <PlayerBar className="area-player" />
      </main>
      <Footer />
      <PlacementOverlay />
    </div>
  );
}
