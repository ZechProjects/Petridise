import React, { useState } from 'react';
import { WorldConfig, BiomeType, ConfigFormState } from '@/types';

interface ConfigPanelProps {
  onStart: (config: ConfigFormState) => void;
  isLoading: boolean;
}

const BIOMES: BiomeType[] = ['ocean', 'forest', 'desert', 'tundra', 'swamp', 'volcanic', 'grassland', 'cave', 'alien'];

const DEFAULT_CONFIG: Partial<WorldConfig> = {
  name: '',
  width: 1000,
  height: 700,
  gravity: 1.0,
  temperature: 20,
  humidity: 50,
  compounds: {
    oxygen: 21,
    water: 60,
    nitrogen: 78,
    carbon: 0.04,
    minerals: 30
  },
  biome: 'forest'
};

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ onStart, isLoading }) => {
  const [useRandom, setUseRandom] = useState(true);
  const [realOrganismsOnly, setRealOrganismsOnly] = useState(false);
  const [worldConfig, setWorldConfig] = useState<Partial<WorldConfig>>(DEFAULT_CONFIG);
  const [simulationDuration, setSimulationDuration] = useState(30);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStart({
      useRandom,
      worldConfig: useRandom ? {} : worldConfig,
      simulationDuration,
      realOrganismsOnly
    });
  };

  const updateCompound = (key: keyof WorldConfig['compounds'], value: number) => {
    setWorldConfig(prev => ({
      ...prev,
      compounds: {
        ...prev.compounds!,
        [key]: value
      }
    }));
  };

  return (
    <div className="bg-petri-accent rounded-xl p-6 shadow-lg border border-petri-highlight">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
        <span className="text-3xl">🧬</span> World Configuration
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Random Toggle */}
        <div className="flex items-center justify-between p-4 bg-petri-bg rounded-lg">
          <label className="text-white font-medium">Generate Random World</label>
          <button
            type="button"
            onClick={() => setUseRandom(!useRandom)}
            className={`relative w-14 h-7 rounded-full transition-colors flex items-center ${
              useRandom ? 'bg-petri-glow' : 'bg-gray-600'
            }`}
          >
            <span
              className={`absolute w-5 h-5 bg-white rounded-full shadow-md transition-all duration-200 ${
                useRandom ? 'left-8' : 'left-1'
              }`}
            />
          </button>
        </div>

        {/* Real Organisms Toggle */}
        <div className="flex items-center justify-between p-4 bg-petri-bg rounded-lg">
          <div>
            <label className="text-white font-medium">Real Earth Organisms Only</label>
            <p className="text-xs text-gray-400 mt-1">Generate only organisms that exist on Earth</p>
          </div>
          <button
            type="button"
            onClick={() => setRealOrganismsOnly(!realOrganismsOnly)}
            className={`relative w-14 h-7 rounded-full transition-colors flex items-center ${
              realOrganismsOnly ? 'bg-petri-glow' : 'bg-gray-600'
            }`}
          >
            <span
              className={`absolute w-5 h-5 bg-white rounded-full shadow-md transition-all duration-200 ${
                realOrganismsOnly ? 'left-8' : 'left-1'
              }`}
            />
          </button>
        </div>

        {!useRandom && (
          <>
            {/* World Name */}
            <div>
              <label className="block text-gray-300 mb-2">World Name</label>
              <input
                type="text"
                value={worldConfig.name}
                onChange={e => setWorldConfig({ ...worldConfig, name: e.target.value })}
                placeholder="Enter world name..."
                className="w-full px-4 py-2 bg-petri-bg border border-petri-highlight rounded-lg text-white focus:outline-none focus:border-petri-glow"
              />
            </div>

            {/* Biome Selection */}
            <div>
              <label className="block text-gray-300 mb-2">Biome</label>
              <div className="grid grid-cols-3 gap-2">
                {BIOMES.map(biome => (
                  <button
                    key={biome}
                    type="button"
                    onClick={() => setWorldConfig({ ...worldConfig, biome })}
                    className={`px-3 py-2 rounded-lg capitalize transition-all ${
                      worldConfig.biome === biome
                        ? 'bg-petri-glow text-white'
                        : 'bg-petri-bg text-gray-400 hover:bg-petri-highlight'
                    }`}
                  >
                    {getBiomeEmoji(biome)} {biome}
                  </button>
                ))}
              </div>
            </div>

            {/* Gravity */}
            <div>
              <label className="block text-gray-300 mb-2">
                Gravity: {worldConfig.gravity?.toFixed(1)}x
              </label>
              <input
                type="range"
                min="0.1"
                max="2"
                step="0.1"
                value={worldConfig.gravity}
                onChange={e => setWorldConfig({ ...worldConfig, gravity: parseFloat(e.target.value) })}
                className="w-full accent-petri-glow"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>Low (Moon)</span>
                <span>Earth</span>
                <span>High</span>
              </div>
            </div>

            {/* Temperature */}
            <div>
              <label className="block text-gray-300 mb-2">
                Temperature: {worldConfig.temperature}°C
              </label>
              <input
                type="range"
                min="-50"
                max="100"
                step="5"
                value={worldConfig.temperature}
                onChange={e => setWorldConfig({ ...worldConfig, temperature: parseInt(e.target.value) })}
                className="w-full accent-petri-glow"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>❄️ Frozen</span>
                <span>🌡️ Temperate</span>
                <span>🔥 Hot</span>
              </div>
            </div>

            {/* Humidity */}
            <div>
              <label className="block text-gray-300 mb-2">
                Humidity: {worldConfig.humidity}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={worldConfig.humidity}
                onChange={e => setWorldConfig({ ...worldConfig, humidity: parseInt(e.target.value) })}
                className="w-full accent-petri-glow"
              />
            </div>

            {/* Compounds */}
            <div>
              <label className="block text-gray-300 mb-3">Compounds</label>
              <div className="space-y-3 bg-petri-bg p-4 rounded-lg">
                {(['oxygen', 'water', 'nitrogen', 'carbon', 'minerals'] as const).map(compound => (
                  <div key={compound}>
                    <div className="flex justify-between text-sm text-gray-400 mb-1">
                      <span className="capitalize">{getCompoundEmoji(compound)} {compound}</span>
                      <span>{worldConfig.compounds?.[compound]}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={worldConfig.compounds?.[compound] || 0}
                      onChange={e => updateCompound(compound, parseInt(e.target.value))}
                      className="w-full accent-petri-glow h-2"
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Simulation Duration */}
        <div>
          <label className="block text-gray-300 mb-2">
            Simulation Duration: {simulationDuration} seconds (~{simulationDuration * 20} ticks)
          </label>
          <input
            type="range"
            min="10"
            max="120"
            step="5"
            value={simulationDuration}
            onChange={e => setSimulationDuration(parseInt(e.target.value))}
            className="w-full accent-petri-glow"
          />
        </div>

        {/* Start Button */}
        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-4 rounded-lg font-bold text-lg transition-all ${
            isLoading
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-petri-glow text-white hover:bg-opacity-90 hover:scale-[1.02]'
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <LoadingSpinner />
              Generating World...
            </span>
          ) : (
            '🚀 Start Simulation'
          )}
        </button>
      </form>
    </div>
  );
};

const LoadingSpinner: React.FC = () => (
  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
      fill="none"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

function getBiomeEmoji(biome: BiomeType): string {
  const emojis: Record<BiomeType, string> = {
    ocean: '🌊',
    forest: '🌲',
    desert: '🏜️',
    tundra: '🏔️',
    swamp: '🐊',
    volcanic: '🌋',
    grassland: '🌾',
    cave: '🦇',
    alien: '👽'
  };
  return emojis[biome];
}

function getCompoundEmoji(compound: string): string {
  const emojis: Record<string, string> = {
    oxygen: '💨',
    water: '💧',
    nitrogen: '🔵',
    carbon: '⚫',
    minerals: '💎'
  };
  return emojis[compound] || '🔷';
}
