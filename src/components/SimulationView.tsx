import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PetridiseGame, TextureConfig } from '@/game';
import { Organism, WorldConfig, SimulationStats } from '@/types';
import { SpeciesDetailPanel } from './SpeciesDetailPanel';
import { WorldDetailPanel } from './WorldDetailPanel';

interface SimulationViewProps {
  world: WorldConfig;
  organisms: Organism[];
  texture: TextureConfig;
  maxTicks: number;
  onComplete: (organisms: Organism[], stats: SimulationStats) => void;
  onPause?: () => void;
  onResume?: () => void;
  onImmersiveModeChange?: (isImmersive: boolean) => void;
}

export const SimulationView: React.FC<SimulationViewProps> = ({
  world,
  organisms,
  texture,
  maxTicks,
  onComplete,
  onImmersiveModeChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<PetridiseGame | null>(null);
  const [currentTick, setCurrentTick] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [simulationEnded, setSimulationEnded] = useState(false);
  const [currentOrganisms, setCurrentOrganisms] = useState<Organism[]>(organisms);
  const [selectedOrganism, setSelectedOrganism] = useState<Organism | null>(null);
  const [showWorldDetails, setShowWorldDetails] = useState(false);
  const [immersiveMode, setImmersiveMode] = useState(false);
  const [showOrganismList, setShowOrganismList] = useState(false);
  const [stats, setStats] = useState<SimulationStats>({
    totalOrganisms: organisms.length,
    births: 0,
    deaths: 0,
    extinctions: [],
    newSpecies: [],
    dominantSpecies: '',
    biodiversityIndex: 0
  });
  const initialCountRef = useRef(organisms.length);

  // Get fullscreen dimensions
  const getFullscreenDimensions = useCallback(() => {
    return {
      width: window.innerWidth,
      height: window.innerHeight
    };
  }, []);

  // Handle window resize
  const handleResize = useCallback(() => {
    const { width, height } = getFullscreenDimensions();
    gameRef.current?.resize(width, height);
  }, [getFullscreenDimensions]);

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  useEffect(() => {
    if (!containerRef.current) return;

    const { width, height } = getFullscreenDimensions();

    // Create game instance with fullscreen dimensions
    gameRef.current = new PetridiseGame({
      parent: containerRef.current,
      width,
      height
    });

    // Small delay to let Phaser initialize
    const timer = setTimeout(() => {
      gameRef.current?.startSimulation(
        world,
        organisms,
        texture,
        maxTicks,
        {
          onTick: (tick) => {
            setCurrentTick(tick);
          },
          onOrganismUpdate: (updatedOrganisms) => {
            setCurrentOrganisms(updatedOrganisms);
            updateStats(updatedOrganisms);
          },
          onSimulationComplete: () => {
            setSimulationEnded(true);
            setIsPaused(true);
            // Organisms keep moving in aquarium mode automatically
          },
          onOrganismClick: (organism) => {
            setSelectedOrganism(organism);
          }
        }
      );
    }, 500);

    return () => {
      clearTimeout(timer);
      gameRef.current?.destroy();
    };
  }, []);

  const updateStats = (updatedOrganisms: Organism[]) => {
    const speciesCount: Record<string, number> = {};
    updatedOrganisms.forEach(org => {
      speciesCount[org.species] = (speciesCount[org.species] || 0) + 1;
    });

    const dominant = Object.entries(speciesCount).sort((a, b) => b[1] - a[1])[0];
    const biodiversity = Object.keys(speciesCount).length / Math.max(updatedOrganisms.length, 1);

    setStats(prev => ({
      ...prev,
      totalOrganisms: updatedOrganisms.length,
      deaths: initialCountRef.current - updatedOrganisms.length + prev.births,
      dominantSpecies: dominant?.[0] || 'None',
      biodiversityIndex: biodiversity
    }));
  };

  const handlePauseResume = () => {
    if (simulationEnded) return;
    if (isPaused) {
      gameRef.current?.resume();
    } else {
      gameRef.current?.pause();
    }
    setIsPaused(!isPaused);
  };

  const handleNextGeneration = () => {
    const finalOrganisms = gameRef.current?.getOrganisms() || currentOrganisms;
    onComplete(finalOrganisms, stats);
  };

  const toggleImmersiveMode = () => {
    const newMode = !immersiveMode;
    setImmersiveMode(newMode);
    setShowOrganismList(false);
    onImmersiveModeChange?.(newMode);
  };

  const progressPercent = (currentTick / maxTicks) * 100;

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Fullscreen Phaser Canvas */}
      <div
        ref={containerRef}
        className="absolute inset-0"
      />

      {/* UI Overlay - hidden in immersive mode */}
      {!immersiveMode && (
        <>
          {/* Top Bar - Glass morphism floating header */}
          <div className="absolute top-4 left-4 right-4 z-10">
            <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 p-3 flex items-center justify-between gap-4">
              {/* Left: Logo & World Info */}
              <div className="flex items-center gap-3">
                <span className="text-2xl">🧫</span>
                <button
                  onClick={() => setShowWorldDetails(true)}
                  className="hidden sm:block text-left hover:bg-white/10 rounded-lg px-2 py-1 -mx-2 -my-1 transition-colors"
                  title="View world details"
                >
                  <h1 className="text-lg font-bold text-white/90 hover:text-white">{world.name}</h1>
                  <p className="text-xs text-white/50">Gen {Math.ceil(currentTick / maxTicks) || 1} • {world.biome} • Click for details</p>
                </button>
              </div>

              {/* Center: Progress & Controls */}
              <div className="flex-1 max-w-md flex items-center gap-3">
                <button
                  onClick={handlePauseResume}
                  disabled={simulationEnded}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    simulationEnded 
                      ? 'bg-green-500/30 text-green-300' 
                      : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                >
                  {simulationEnded ? '✓' : isPaused ? '▶' : '⏸'}
                </button>
                
                {/* Progress Bar */}
                <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-100 ${
                      simulationEnded 
                        ? 'bg-gradient-to-r from-green-500 to-emerald-400'
                        : 'bg-gradient-to-r from-cyan-500 to-purple-500'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                
                <span className="text-sm text-white/60 min-w-[60px]">
                  {currentTick}/{maxTicks}
                </span>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleNextGeneration}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl text-white hover:scale-105 transition-all text-sm font-medium shadow-lg shadow-purple-500/20"
                >
                  🧬 Next Gen
                </button>
                <button
                  onClick={toggleImmersiveMode}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
                  title="Immersive Mode"
                >
                  🖼️
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Stats Bar */}
          <div className="absolute bottom-4 left-4 right-4 z-10">
            <div className="flex items-end justify-between gap-4">
              {/* Organism List Toggle */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setShowOrganismList(!showOrganismList)}
                  className="bg-black/40 backdrop-blur-md rounded-xl border border-white/10 px-4 py-2 text-white/80 hover:bg-white/10 transition-all text-sm"
                >
                  🦠 {currentOrganisms.length} organisms {showOrganismList ? '▼' : '▲'}
                </button>
                
                {/* Expandable Organism List */}
                {showOrganismList && (
                  <div className="bg-black/60 backdrop-blur-md rounded-xl border border-white/10 p-3 max-h-48 overflow-y-auto w-64">
                    <div className="space-y-1">
                      {currentOrganisms.slice(0, 20).map(org => (
                        <button
                          key={org.id}
                          onClick={() => setSelectedOrganism(org)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors text-left"
                        >
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: org.color }}
                          />
                          <span className="text-white/80 text-sm truncate">{org.name}</span>
                          <span className="text-white/40 text-xs ml-auto">{org.energy.toFixed(0)}⚡</span>
                        </button>
                      ))}
                      {currentOrganisms.length > 20 && (
                        <p className="text-white/40 text-xs text-center pt-2">
                          +{currentOrganisms.length - 20} more
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Stats Pills */}
              <div className="flex gap-2">
                <StatPill icon="👑" value={stats.dominantSpecies || 'None'} />
                <StatPill icon="🌈" value={`${(stats.biodiversityIndex * 100).toFixed(0)}%`} />
                <StatPill icon="💀" value={stats.deaths.toString()} />
              </div>
            </div>
          </div>

          {/* Simulation Complete Overlay */}
          {simulationEnded && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10">
              <div className="bg-green-500/20 backdrop-blur-md rounded-2xl border border-green-400/30 px-6 py-3 flex items-center gap-3">
                <span className="text-2xl">🎉</span>
                <div>
                  <p className="text-green-300 font-medium">Cycle complete!</p>
                  <p className="text-green-400/60 text-sm">Click organisms or proceed to next generation</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Immersive Mode - Minimal UI */}
      {immersiveMode && (
        <button
          onClick={toggleImmersiveMode}
          className="absolute top-4 right-4 z-10 w-12 h-12 rounded-full bg-black/30 backdrop-blur-sm hover:bg-black/50 flex items-center justify-center transition-all text-white/60 hover:text-white"
          title="Exit Immersive Mode"
        >
          ✕
        </button>
      )}

      {/* Selected Organism Panel */}
      {selectedOrganism && (
        <SpeciesDetailPanel
          organism={selectedOrganism}
          worldBiome={world.biome}
          onClose={() => setSelectedOrganism(null)}
        />
      )}

      {/* World Details Panel */}
      {showWorldDetails && (
        <WorldDetailPanel
          world={world}
          organismCount={currentOrganisms.length}
          currentTick={currentTick}
          maxTicks={maxTicks}
          onClose={() => setShowWorldDetails(false)}
        />
      )}

      {/* Paused Overlay (only when manually paused, not when simulation ended) */}
      {isPaused && !simulationEnded && !immersiveMode && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-5 pointer-events-none">
          <div className="text-6xl text-white/80 font-bold tracking-widest">PAUSED</div>
        </div>
      )}
    </div>
  );
};

interface StatPillProps {
  icon: string;
  value: string;
}

const StatPill: React.FC<StatPillProps> = ({ icon, value }) => (
  <div className="bg-black/40 backdrop-blur-md rounded-xl border border-white/10 px-3 py-2 flex items-center gap-2">
    <span>{icon}</span>
    <span className="text-white/80 text-sm font-medium">{value}</span>
  </div>
);
