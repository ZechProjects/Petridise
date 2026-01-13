import React, { useState, useEffect } from 'react';
import { WorldConfig } from '@/types';
import { compressImageForStorage } from '@/utils';

interface WorldDetailPanelProps {
  world: WorldConfig;
  organismCount: number;
  currentTick: number;
  maxTicks: number;
  onClose: () => void;
}

const WORLD_IMAGE_CACHE_PREFIX = 'petridise_world_image_';

export const WorldDetailPanel: React.FC<WorldDetailPanelProps> = ({
  world,
  organismCount,
  currentTick,
  maxTicks,
  onClose
}) => {
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [worldImage, setWorldImage] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  // Create a cache key based on world name and biome
  const cacheKey = `${WORLD_IMAGE_CACHE_PREFIX}${world.name}_${world.biome}`;

  // Load cached image on mount and auto-generate if not cached
  useEffect(() => {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      setWorldImage(cached);
    } else {
      // Auto-generate image if not cached
      generateWorldImage();
    }
  }, [cacheKey]);

  const generateWorldImage = async () => {
    // Check cache first
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      setWorldImage(cached);
      return;
    }

    setIsGeneratingImage(true);
    setImageError(null);

    try {
      const response = await fetch('/api/generate-world-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ world })
      });

      if (!response.ok) {
        throw new Error('Failed to generate world image');
      }

      const data = await response.json();
      setWorldImage(data.imageData);
      
      // Compress and cache in sessionStorage
      try {
        const compressed = await compressImageForStorage(data.imageData, 600, 400, 0.7);
        sessionStorage.setItem(cacheKey, compressed);
      } catch (storageError) {
        // Quota exceeded - clear old world images and try again
        console.warn('SessionStorage quota exceeded, clearing old world images...');
        const keysToRemove: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key?.startsWith('petridise_world_image_')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => sessionStorage.removeItem(key));
        try {
          const compressed = await compressImageForStorage(data.imageData, 600, 400, 0.7);
          sessionStorage.setItem(cacheKey, compressed);
        } catch {
          // Still failed, just skip caching
          console.warn('Could not cache world image');
        }
      }
    } catch (error) {
      console.error('Error generating world image:', error);
      setImageError('Failed to generate world image. Please try again.');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const getBiomeEmoji = (biome: string): string => {
    const emojis: Record<string, string> = {
      ocean: '🌊',
      forest: '🌲',
      desert: '🏜️',
      tundra: '❄️',
      swamp: '🌿',
      volcanic: '🌋',
      grassland: '🌾',
      cave: '🕳️',
      alien: '👽'
    };
    return emojis[biome] || '🌍';
  };

  const getTemperatureColor = (temp: number): string => {
    if (temp < 0) return 'text-cyan-400';
    if (temp < 20) return 'text-blue-400';
    if (temp < 35) return 'text-green-400';
    if (temp < 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  const formatTemperature = (temp: number): string => {
    return `${temp}°C / ${Math.round(temp * 9/5 + 32)}°F`;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-black/80 backdrop-blur-md border border-white/20 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-900/50 to-blue-900/50 p-4 rounded-t-2xl flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl bg-gradient-to-br from-cyan-500/30 to-blue-500/30 border-2 border-white/30 shadow-lg">
              {getBiomeEmoji(world.biome)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{world.name}</h2>
              <p className="text-white/60 text-sm capitalize">{world.biome} Biome</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-300 text-2xl p-2"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* World Image */}
          {worldImage && (
            <div className="bg-white/5 rounded-lg overflow-hidden border border-white/10">
              <img
                src={worldImage}
                alt={world.name}
                className="w-full h-48 object-cover"
              />
            </div>
          )}

          {imageError && (
            <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3 text-red-300">
              {imageError}
            </div>
          )}

          {/* Generate Image Button */}
          {!worldImage && (
            <button
              onClick={generateWorldImage}
              disabled={isGeneratingImage}
              className={`w-full py-3 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
                isGeneratingImage
                  ? 'bg-white/10 text-white/40 cursor-not-allowed'
                  : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:scale-[1.02] shadow-lg shadow-cyan-500/20'
              }`}
            >
              {isGeneratingImage ? (
                <>
                  <LoadingSpinner />
                  Generating World Image...
                </>
              ) : (
                <>
                  🖼️ Generate World Image
                </>
              )}
            </button>
          )}

          {/* Environment Stats */}
          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
            <h3 className="text-white font-bold mb-3 flex items-center gap-2">
              <span>🌡️</span> Environment
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🌡️</span>
                <div>
                  <div className={`font-medium text-sm ${getTemperatureColor(world.temperature)}`}>
                    {formatTemperature(world.temperature)}
                  </div>
                  <div className="text-white/40 text-xs">Temperature</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">💧</span>
                <div>
                  <div className="text-white font-medium text-sm">{world.humidity}%</div>
                  <div className="text-white/40 text-xs">Humidity</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">⬇️</span>
                <div>
                  <div className="text-white font-medium text-sm">{world.gravity.toFixed(2)}g</div>
                  <div className="text-white/40 text-xs">Gravity</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">📐</span>
                <div>
                  <div className="text-white font-medium text-sm">{world.width} × {world.height}</div>
                  <div className="text-white/40 text-xs">Dimensions</div>
                </div>
              </div>
            </div>
          </div>

          {/* Compounds */}
          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
            <h3 className="text-white font-bold mb-3 flex items-center gap-2">
              <span>⚗️</span> Compounds
            </h3>
            <div className="space-y-2">
              <CompoundBar name="Oxygen" value={world.compounds.oxygen} color="from-cyan-500 to-blue-500" icon="💨" />
              <CompoundBar name="Water" value={world.compounds.water} color="from-blue-500 to-indigo-500" icon="💧" />
              <CompoundBar name="Nitrogen" value={world.compounds.nitrogen} color="from-purple-500 to-pink-500" icon="🟣" />
              <CompoundBar name="Carbon" value={world.compounds.carbon} color="from-gray-500 to-gray-700" icon="⚫" />
              <CompoundBar name="Minerals" value={world.compounds.minerals} color="from-amber-500 to-orange-500" icon="💎" />
            </div>
          </div>

          {/* Simulation Status */}
          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
            <h3 className="text-white font-bold mb-3 flex items-center gap-2">
              <span>📊</span> Simulation Status
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🦠</span>
                <div>
                  <div className="text-white font-medium text-sm">{organismCount}</div>
                  <div className="text-white/40 text-xs">Organisms</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">⏱️</span>
                <div>
                  <div className="text-white font-medium text-sm">{currentTick} / {maxTicks}</div>
                  <div className="text-white/40 text-xs">Ticks</div>
                </div>
              </div>
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-xs text-white/40 mb-1">
                <span>Progress</span>
                <span>{Math.round((currentTick / maxTicks) * 100)}%</span>
              </div>
              <div className="h-2 bg-black/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-purple-500"
                  style={{ width: `${(currentTick / maxTicks) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Regenerate Image Button (if already generated) */}
          {worldImage && (
            <button
              onClick={() => {
                sessionStorage.removeItem(cacheKey);
                setWorldImage(null);
                generateWorldImage();
              }}
              disabled={isGeneratingImage}
              className={`w-full py-2 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                isGeneratingImage
                  ? 'bg-white/5 text-white/30 cursor-not-allowed'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              {isGeneratingImage ? (
                <>
                  <LoadingSpinner />
                  Regenerating...
                </>
              ) : (
                <>
                  🔄 Regenerate World Image
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

interface CompoundBarProps {
  name: string;
  value: number;
  color: string;
  icon: string;
}

const CompoundBar: React.FC<CompoundBarProps> = ({ name, value, color, icon }) => (
  <div className="flex items-center gap-2">
    <span className="text-sm w-5">{icon}</span>
    <span className="text-white/60 text-sm w-20">{name}</span>
    <div className="flex-1 h-2 bg-black/30 rounded-full overflow-hidden">
      <div
        className={`h-full bg-gradient-to-r ${color}`}
        style={{ width: `${value}%` }}
      />
    </div>
    <span className="text-white/50 text-xs w-8 text-right">{value}%</span>
  </div>
);

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
