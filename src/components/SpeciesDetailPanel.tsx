import React, { useState } from 'react';
import { Organism } from '@/types';

interface SpeciesDetailPanelProps {
  organism: Organism;
  worldBiome: string;
  onClose: () => void;
}

export const SpeciesDetailPanel: React.FC<SpeciesDetailPanelProps> = ({
  organism,
  worldBiome,
  onClose
}) => {
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const generateImage = async () => {
    setIsGeneratingImage(true);
    setImageError(null);

    try {
      const response = await fetch('/api/generate-organism-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organism,
          worldBiome
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate image');
      }

      const data = await response.json();
      setGeneratedImage(data.imageData);
    } catch (error) {
      console.error('Error generating organism image:', error);
      setImageError('Failed to generate image. Please try again.');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const getTypeEmoji = (type: string): string => {
    const emojis: Record<string, string> = {
      plant: '🌿',
      herbivore: '🐰',
      carnivore: '🦁',
      omnivore: '🐻',
      decomposer: '🍄',
      microbe: '🦠'
    };
    return emojis[type] || '❓';
  };

  const getBehaviorDescription = (behavior: string): string => {
    const descriptions: Record<string, string> = {
      passive: 'Calm and non-threatening',
      aggressive: 'Actively hunts others',
      territorial: 'Defends its area',
      social: 'Lives in groups',
      solitary: 'Prefers to be alone',
      migratory: 'Moves across the world'
    };
    return descriptions[behavior] || behavior;
  };

  const getDietDescription = (diet?: string): string => {
    if (!diet) return 'Unknown diet';
    const descriptions: Record<string, string> = {
      photosynthesis: 'Gets energy from light',
      herbivore: 'Eats plants',
      carnivore: 'Eats other organisms',
      omnivore: 'Eats plants and organisms',
      decomposer: 'Breaks down dead matter'
    };
    return descriptions[diet] || diet;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-black/80 backdrop-blur-md border border-white/20 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 p-4 rounded-t-2xl flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-2xl border-2 border-white/50 shadow-lg"
              style={{ backgroundColor: organism.color }}
            >
              {getTypeEmoji(organism.type)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{organism.name}</h2>
              <p className="text-white/60 text-sm">{organism.species}</p>
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
          {/* Description */}
          {organism.description && (
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <p className="text-white/70 italic">"{organism.description}"</p>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <StatItem label="Type" value={organism.type} icon={getTypeEmoji(organism.type)} />
            <StatItem label="Size" value={`${organism.size}px`} icon="📏" />
            <StatItem label="Speed" value={organism.speed.toFixed(1)} icon="💨" />
            <StatItem label="Energy" value={Math.round(organism.energy).toString()} icon="⚡" />
            <StatItem label="Age" value={`${organism.age} / ${organism.maxAge}`} icon="⏳" />
            <StatItem label="Behavior" value={organism.behavior} icon="🎭" />
          </div>

          {/* Diet & Behavior */}
          <div className="bg-white/5 rounded-lg p-3 space-y-2 border border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-lg">🍽️</span>
              <span className="text-white/50">Diet:</span>
              <span className="text-white">{getDietDescription(organism.diet)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🎭</span>
              <span className="text-white/50">Personality:</span>
              <span className="text-white">{getBehaviorDescription(organism.behavior)}</span>
            </div>
          </div>

          {/* Traits */}
          {organism.traits && organism.traits.length > 0 && (
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <h3 className="text-white font-bold mb-2 flex items-center gap-2">
                <span>🧬</span> Traits
              </h3>
              <div className="space-y-2">
                {organism.traits.map((trait, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div>
                      <span className="text-white">{trait.name}</span>
                      <p className="text-white/40 text-xs">{trait.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-black/30 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-purple-500"
                          style={{ width: `${trait.value}%` }}
                        />
                      </div>
                      <span className="text-white/50 text-xs w-8">{trait.value}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ancestry */}
          {organism.ancestry && organism.ancestry.length > 0 && (
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <h3 className="text-white font-bold mb-2 flex items-center gap-2">
                <span>🌳</span> Evolution Ancestry
              </h3>
              <div className="flex flex-wrap gap-2">
                {organism.ancestry.map((ancestor, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-black/30 rounded-full text-xs text-white/70 flex items-center gap-1"
                  >
                    {index > 0 && <span className="text-white/30">→</span>}
                    {ancestor}
                  </span>
                ))}
                <span className="px-2 py-1 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full text-xs text-white font-bold">
                  → {organism.name}
                </span>
              </div>
            </div>
          )}

          {organism.generation && (
            <div className="text-center text-white/40 text-sm">
              First appeared in Generation {organism.generation}
            </div>
          )}

          {/* Generated Image */}
          {generatedImage && (
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <h3 className="text-white font-bold mb-2 flex items-center gap-2">
                <span>🖼️</span> Photo-Realistic Visualization
              </h3>
              <img
                src={generatedImage}
                alt={organism.name}
                className="w-full rounded-lg border border-white/20"
              />
            </div>
          )}

          {imageError && (
            <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3 text-red-300">
              {imageError}
            </div>
          )}

          {/* Generate Image Button */}
          <button
            onClick={generateImage}
            disabled={isGeneratingImage}
            className={`w-full py-3 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
              isGeneratingImage
                ? 'bg-white/10 text-white/40 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:scale-[1.02] shadow-lg shadow-purple-500/20'
            }`}
          >
            {isGeneratingImage ? (
              <>
                <LoadingSpinner />
                Generating Image...
              </>
            ) : generatedImage ? (
              <>
                🔄 Regenerate Image
              </>
            ) : (
              <>
                📸 Generate Photo-Realistic Image
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

interface StatItemProps {
  label: string;
  value: string;
  icon: string;
}

const StatItem: React.FC<StatItemProps> = ({ label, value, icon }) => (
  <div className="bg-white/5 rounded-lg p-2 flex items-center gap-2 border border-white/10">
    <span className="text-lg">{icon}</span>
    <div>
      <div className="text-white font-medium text-sm capitalize">{value}</div>
      <div className="text-white/40 text-xs">{label}</div>
    </div>
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
