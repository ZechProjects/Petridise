import { useState, useCallback, useEffect } from 'react';
import {
  SimulationStatus,
  WorldConfig,
  Organism,
  SimulationEvent,
  SimulationStats,
  ConfigFormState,
  GenerateWorldResponse,
  EvolveResponse,
  ExportedWorld
} from '@/types';
import { TextureConfig, FallbackTextureConfig } from '@/game';

const STORAGE_KEY_API_KEY = 'petridise_gemini_api_key';

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
  const [userApiKey, setUserApiKey] = useState<string>('');

  // Load API key from localStorage on mount
  useEffect(() => {
    const storedKey = localStorage.getItem(STORAGE_KEY_API_KEY);
    if (storedKey) {
      setUserApiKey(storedKey);
    }
  }, []);

  // Save API key to localStorage when changed
  const updateApiKey = useCallback((key: string) => {
    setUserApiKey(key);
    if (key) {
      localStorage.setItem(STORAGE_KEY_API_KEY, key);
    } else {
      localStorage.removeItem(STORAGE_KEY_API_KEY);
    }
  }, []);

  // Helper to get headers with API key
  const getApiHeaders = useCallback(() => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (userApiKey) {
      headers['X-Gemini-Api-Key'] = userApiKey;
    }
    return headers;
  }, [userApiKey]);

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
        headers: getApiHeaders(),
        body: JSON.stringify(requestBody)
      });

      if (!worldResponse.ok) {
        const errorData = await worldResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate world');
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
        headers: getApiHeaders(),
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
  }, [getApiHeaders]);

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
        headers: getApiHeaders(),
        body: JSON.stringify(evolveRequestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to evolve world');
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
  }, [world, generation, organisms, events, stats, getApiHeaders]);

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

  // Export world to JSON
  const exportWorld = useCallback((): ExportedWorld | null => {
    if (!world) return null;
    
    const exportData: ExportedWorld = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      generation,
      world,
      organisms,
      events,
      stats,
      narrative
    };
    
    return exportData;
  }, [world, generation, organisms, events, stats, narrative]);

  // Download world as JSON file
  const downloadWorld = useCallback(() => {
    const data = exportWorld();
    if (!data) return;
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.world.name || 'petridise-world'}-gen${data.generation}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [exportWorld]);

  // Import world from JSON
  const importWorld = useCallback(async (file: File): Promise<boolean> => {
    try {
      const text = await file.text();
      const data: ExportedWorld = JSON.parse(text);
      
      // Validate the imported data
      if (!data.version || !data.world || !data.organisms) {
        throw new Error('Invalid world file format');
      }
      
      // Set all the state
      setWorld(data.world);
      setOrganisms(data.organisms);
      setEvents(data.events || []);
      setStats(data.stats || { ...DEFAULT_STATS, totalOrganisms: data.organisms.length });
      setNarrative(data.narrative || 'Imported world');
      setGeneration(data.generation || 1);
      setMaxTicks(600); // Default simulation duration
      setRealOrganismsOnly(false);
      
      // Generate texture for the imported world
      setStatus('generating');
      setIsGenerating(true);
      
      const textureRequestBody = {
        biome: data.world.biome,
        world: data.world
      };

      const textureResponse = await fetch('/api/generate-texture', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify(textureRequestBody)
      });

      let textureData: TextureConfig;
      if (textureResponse.ok) {
        textureData = await textureResponse.json();
      } else {
        textureData = getDefaultTexture(data.world.biome);
      }

      setTexture(textureData);
      setStatus('running');
      setIsGenerating(false);
      setError(null);
      
      return true;
    } catch (err) {
      console.error('Error importing world:', err);
      setError(err instanceof Error ? err.message : 'Failed to import world');
      return false;
    }
  }, [getApiHeaders]);

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
    userApiKey,
    // Actions
    generateWorld,
    evolve,
    continueSimulation,
    completeRun,
    reset,
    clearDebugHistory,
    updateApiKey,
    exportWorld,
    downloadWorld,
    importWorld
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
