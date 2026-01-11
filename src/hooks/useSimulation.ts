import { useState, useCallback } from 'react';
import {
  SimulationStatus,
  WorldConfig,
  Organism,
  SimulationEvent,
  SimulationStats,
  ConfigFormState,
  GenerateWorldResponse,
  EvolveResponse
} from '@/types';
import { TextureConfig, FallbackTextureConfig } from '@/game';

const DEFAULT_STATS: SimulationStats = {
  totalOrganisms: 0,
  births: 0,
  deaths: 0,
  extinctions: [],
  newSpecies: [],
  dominantSpecies: '',
  biodiversityIndex: 0
};

export interface ApiDebugData {
  type: 'generate-world' | 'evolve' | 'generate-texture';
  request: object;
  response: object | null;
  timestamp: Date;
}

export function useSimulation() {
  const [status, setStatus] = useState<SimulationStatus>('configuring');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEvolving, setIsEvolving] = useState(false);
  const [generation, setGeneration] = useState(1);
  const [world, setWorld] = useState<WorldConfig | null>(null);
  const [organisms, setOrganisms] = useState<Organism[]>([]);
  const [events, setEvents] = useState<SimulationEvent[]>([]);
  const [stats, setStats] = useState<SimulationStats>(DEFAULT_STATS);
  const [texture, setTexture] = useState<TextureConfig | null>(null);
  const [narrative, setNarrative] = useState('');
  const [maxTicks, setMaxTicks] = useState(600);
  const [error, setError] = useState<string | null>(null);
  const [evolveResult, setEvolveResult] = useState<EvolveResponse | null>(null);
  const [apiDebugHistory, setApiDebugHistory] = useState<ApiDebugData[]>([]);
  const [realOrganismsOnly, setRealOrganismsOnly] = useState(false);

  const addDebugEntry = (entry: ApiDebugData) => {
    setApiDebugHistory(prev => [...prev, entry]);
  };

  const clearDebugHistory = () => {
    setApiDebugHistory([]);
  };

  const generateWorld = useCallback(async (config: ConfigFormState) => {
    setStatus('generating');
    setIsGenerating(true);
    setError(null);

    const requestBody = {
      useRandom: config.useRandom,
      worldConfig: config.worldConfig,
      realOrganismsOnly: config.realOrganismsOnly
    };

    try {
      // Generate world
      const worldResponse = await fetch('/api/generate-world', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!worldResponse.ok) {
        throw new Error('Failed to generate world');
      }

      const worldData: GenerateWorldResponse = await worldResponse.json();

      // Log debug data
      addDebugEntry({
        type: 'generate-world',
        request: requestBody,
        response: worldData,
        timestamp: new Date()
      });
      
      // Generate texture
      const textureRequestBody = {
        biome: worldData.world.biome,
        world: worldData.world
      };

      const textureResponse = await fetch('/api/generate-texture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(textureRequestBody)
      });

      let textureData: TextureConfig;
      if (textureResponse.ok) {
        textureData = await textureResponse.json();
        addDebugEntry({
          type: 'generate-texture',
          request: textureRequestBody,
          response: textureData,
          timestamp: new Date()
        });
      } else {
        // Fallback texture
        textureData = getDefaultTexture(worldData.world.biome);
        addDebugEntry({
          type: 'generate-texture',
          request: textureRequestBody,
          response: { fallback: true, texture: textureData },
          timestamp: new Date()
        });
      }

      // Set state
      setWorld(worldData.world);
      setOrganisms(worldData.organisms);
      setTexture(textureData);
      setNarrative(worldData.narrative || 'A new world emerges...');
      setMaxTicks(config.simulationDuration * 20);
      setGeneration(1);
      setEvents([]);
      setStats({
        ...DEFAULT_STATS,
        totalOrganisms: worldData.organisms.length
      });
      setEvolveResult(null);
      setRealOrganismsOnly(config.realOrganismsOnly);
      setStatus('running');
      setIsGenerating(false);

    } catch (err) {
      console.error('Error generating world:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate world');
      setStatus('configuring');
      setIsGenerating(false);
    }
  }, []);

  const evolve = useCallback(async () => {
    if (!world) return;

    setStatus('evolving');
    setIsEvolving(true);
    setError(null);

    const evolveRequestBody = {
      generation,
      world,
      organisms,
      events,
      statistics: stats,
      realOrganismsOnly
    };

    try {
      const response = await fetch('/api/evolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(evolveRequestBody)
      });

      if (!response.ok) {
        throw new Error('Failed to evolve world');
      }

      const evolveData: EvolveResponse = await response.json();

      // Log debug data
      addDebugEntry({
        type: 'evolve',
        request: evolveRequestBody,
        response: evolveData,
        timestamp: new Date()
      });
      
      setEvolveResult(evolveData);
      
      // Apply world changes
      if (evolveData.worldChanges) {
        setWorld(prev => prev ? { ...prev, ...evolveData.worldChanges } : null);
      }

      // Update organisms for next run
      setOrganisms(evolveData.organisms);
      setEvents(evolveData.events);
      setNarrative(evolveData.narrative);
      setGeneration(prev => prev + 1);
      setStats(prev => ({
        ...prev,
        totalOrganisms: evolveData.organisms.length
      }));
      setIsEvolving(false);

    } catch (err) {
      console.error('Error evolving:', err);
      setError(err instanceof Error ? err.message : 'Failed to evolve');
      setIsEvolving(false);
    }
  }, [world, generation, organisms, events, stats]);

  const continueSimulation = useCallback(async () => {
    if (!evolveResult) {
      await evolve();
    }
    setStatus('running');
    setEvents([]);
    setEvolveResult(null);
  }, [evolve, evolveResult]);

  const completeRun = useCallback((finalOrganisms: Organism[], finalStats: SimulationStats) => {
    setOrganisms(finalOrganisms);
    setStats(finalStats);
    setStatus('completed');
  }, []);

  const reset = useCallback(() => {
    setStatus('configuring');
    setGeneration(1);
    setWorld(null);
    setOrganisms([]);
    setEvents([]);
    setStats(DEFAULT_STATS);
    setTexture(null);
    setNarrative('');
    setError(null);
    setEvolveResult(null);
    setIsGenerating(false);
    setIsEvolving(false);
    clearDebugHistory();
  }, []);

  return {
    // State
    status,
    isGenerating,
    isEvolving,
    generation,
    world,
    organisms,
    events,
    stats,
    texture,
    narrative,
    maxTicks,
    error,
    evolveResult,
    apiDebugHistory,
    // Actions
    generateWorld,
    evolve,
    continueSimulation,
    completeRun,
    reset,
    clearDebugHistory
  };
}

function getDefaultTexture(biome: string): FallbackTextureConfig {
  const textures: Record<string, FallbackTextureConfig> = {
    ocean: {
      type: 'fallback',
      backgroundColor: '#0a1628',
      gradientColors: ['#0a1628', '#1a365d', '#2563eb'],
      patternType: 'waves',
      patternColor: '#3b82f6',
      patternOpacity: 0.3,
      accentColors: ['#06b6d4', '#0284c7']
    },
    forest: {
      type: 'fallback',
      backgroundColor: '#0f2419',
      gradientColors: ['#0f2419', '#14532d', '#166534'],
      patternType: 'organic',
      patternColor: '#22c55e',
      patternOpacity: 0.2,
      accentColors: ['#84cc16', '#4ade80']
    },
    desert: {
      type: 'fallback',
      backgroundColor: '#451a03',
      gradientColors: ['#451a03', '#78350f', '#a16207'],
      patternType: 'dots',
      patternColor: '#fbbf24',
      patternOpacity: 0.15,
      accentColors: ['#f59e0b', '#d97706']
    },
    tundra: {
      type: 'fallback',
      backgroundColor: '#1e3a5f',
      gradientColors: ['#1e3a5f', '#60a5fa', '#bfdbfe'],
      patternType: 'crystalline',
      patternColor: '#e0f2fe',
      patternOpacity: 0.25,
      accentColors: ['#7dd3fc', '#38bdf8']
    },
    swamp: {
      type: 'fallback',
      backgroundColor: '#1a2e1a',
      gradientColors: ['#1a2e1a', '#365314', '#3f6212'],
      patternType: 'cellular',
      patternColor: '#84cc16',
      patternOpacity: 0.2,
      accentColors: ['#65a30d', '#4d7c0f']
    },
    volcanic: {
      type: 'fallback',
      backgroundColor: '#1c1917',
      gradientColors: ['#1c1917', '#7c2d12', '#ea580c'],
      patternType: 'organic',
      patternColor: '#f97316',
      patternOpacity: 0.3,
      accentColors: ['#ef4444', '#dc2626']
    },
    grassland: {
      type: 'fallback',
      backgroundColor: '#1a2e05',
      gradientColors: ['#1a2e05', '#365314', '#4d7c0f'],
      patternType: 'dots',
      patternColor: '#a3e635',
      patternOpacity: 0.15,
      accentColors: ['#bef264', '#84cc16']
    },
    cave: {
      type: 'fallback',
      backgroundColor: '#0f0f0f',
      gradientColors: ['#0f0f0f', '#1f1f1f', '#2a2a2a'],
      patternType: 'crystalline',
      patternColor: '#6b7280',
      patternOpacity: 0.2,
      accentColors: ['#9ca3af', '#6b7280']
    },
    alien: {
      type: 'fallback',
      backgroundColor: '#1e1b4b',
      gradientColors: ['#1e1b4b', '#4c1d95', '#7c3aed'],
      patternType: 'cellular',
      patternColor: '#a855f7',
      patternOpacity: 0.3,
      accentColors: ['#c084fc', '#e879f9']
    }
  };

  return textures[biome] || textures.forest;
}
