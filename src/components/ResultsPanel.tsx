import React from 'react';
import { SimulationEvent, SimulationStats, Organism, EvolveResponse } from '@/types';

interface ResultsPanelProps {
  generation: number;
  organisms: Organism[];
  events: SimulationEvent[];
  stats: SimulationStats;
  narrative: string;
  evolveResult?: EvolveResponse;
  onContinue: () => void;
  onReset: () => void;
  isEvolving: boolean;
}

export const ResultsPanel: React.FC<ResultsPanelProps> = ({
  generation,
  organisms,
  events,
  stats,
  narrative,
  evolveResult,
  onContinue,
  onReset,
  isEvolving
}) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-petri-highlight to-petri-accent rounded-xl p-6 text-center">
        <h2 className="text-3xl font-bold text-white mb-2">
          Generation {generation} Complete! 🎉
        </h2>
        <p className="text-gray-300 text-lg italic">"{narrative}"</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatBox
          label="Survivors"
          value={organisms.length}
          icon="🦠"
          color="bg-green-500"
        />
        <StatBox
          label="Deaths"
          value={stats.deaths}
          icon="💀"
          color="bg-red-500"
        />
        <StatBox
          label="Births"
          value={stats.births}
          icon="🐣"
          color="bg-blue-500"
        />
        <StatBox
          label="Biodiversity"
          value={`${(stats.biodiversityIndex * 100).toFixed(0)}%`}
          icon="🌈"
          color="bg-purple-500"
        />
      </div>

      {/* Events Timeline */}
      <div className="bg-petri-accent rounded-xl p-6">
        <h3 className="text-xl font-bold text-white mb-4">📜 Notable Events</h3>
        {events.length === 0 ? (
          <p className="text-gray-400">No significant events occurred this generation.</p>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {events.map((event, index) => (
              <EventCard key={event.id || index} event={event} />
            ))}
          </div>
        )}
      </div>

      {/* Evolution Preview */}
      {evolveResult && (
        <div className="bg-petri-accent rounded-xl p-6">
          <h3 className="text-xl font-bold text-white mb-4">🧬 Evolution Preview</h3>
          <p className="text-gray-300 mb-4">{evolveResult.narrative}</p>
          
          {evolveResult.nextGenerationSuggestions && (
            <div className="bg-petri-bg rounded-lg p-4">
              <h4 className="text-sm font-bold text-gray-400 mb-2">What might happen next:</h4>
              <ul className="list-disc list-inside text-gray-300 space-y-1">
                {evolveResult.nextGenerationSuggestions.map((suggestion, i) => (
                  <li key={i}>{suggestion}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Surviving Species */}
      <div className="bg-petri-accent rounded-xl p-6">
        <h3 className="text-xl font-bold text-white mb-4">🏆 Surviving Species</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {getSpeciesSummary(organisms).map(species => (
            <div
              key={species.name}
              className="bg-petri-bg rounded-lg p-3 flex items-center gap-3"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
                style={{ backgroundColor: species.color }}
              >
                {getTypeEmoji(species.type)}
              </div>
              <div>
                <div className="text-white font-medium">{species.name}</div>
                <div className="text-gray-400 text-sm">
                  {species.count} individuals
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={onContinue}
          disabled={isEvolving || organisms.length === 0}
          className={`flex-1 py-4 rounded-xl font-bold text-lg transition-all ${
            isEvolving || organisms.length === 0
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-petri-glow text-white hover:scale-[1.02]'
          }`}
        >
          {isEvolving ? (
            <span className="flex items-center justify-center gap-2">
              <LoadingSpinner />
              Evolving...
            </span>
          ) : organisms.length === 0 ? (
            '☠️ All Life Extinct'
          ) : (
            '🧬 Evolve & Continue'
          )}
        </button>
        <button
          onClick={onReset}
          className="px-8 py-4 rounded-xl font-bold text-lg bg-petri-highlight text-white hover:bg-petri-accent transition-all"
        >
          🔄 New World
        </button>
      </div>
    </div>
  );
};

interface StatBoxProps {
  label: string;
  value: number | string;
  icon: string;
  color: string;
}

const StatBox: React.FC<StatBoxProps> = ({ label, value, icon, color }) => (
  <div className="bg-petri-accent rounded-xl p-4 text-center">
    <div className={`w-12 h-12 ${color} rounded-full flex items-center justify-center text-2xl mx-auto mb-2`}>
      {icon}
    </div>
    <div className="text-2xl font-bold text-white">{value}</div>
    <div className="text-gray-400 text-sm">{label}</div>
  </div>
);

interface EventCardProps {
  event: SimulationEvent;
}

const EventCard: React.FC<EventCardProps> = ({ event }) => {
  const significanceColors = {
    minor: 'border-gray-500',
    moderate: 'border-blue-500',
    major: 'border-yellow-500',
    catastrophic: 'border-red-500'
  };

  return (
    <div className={`border-l-4 ${significanceColors[event.significance]} bg-petri-bg rounded-r-lg p-3`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{getEventEmoji(event.type)}</span>
        <span className="text-white font-medium">{event.title}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          event.significance === 'catastrophic' ? 'bg-red-500' :
          event.significance === 'major' ? 'bg-yellow-500' :
          event.significance === 'moderate' ? 'bg-blue-500' : 'bg-gray-500'
        }`}>
          {event.significance}
        </span>
      </div>
      <p className="text-gray-400 text-sm">{event.description}</p>
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

function getEventEmoji(type: string): string {
  const emojis: Record<string, string> = {
    birth: '🐣',
    death: '💀',
    evolution: '🧬',
    mutation: '🔬',
    migration: '🦅',
    disease: '🦠',
    extinction: '☠️',
    speciation: '🌟',
    climate_change: '🌡️',
    natural_disaster: '💥',
    symbiosis: '🤝',
    predation: '🦁'
  };
  return emojis[type] || '📝';
}

function getTypeEmoji(type: string): string {
  const emojis: Record<string, string> = {
    plant: '🌿',
    herbivore: '🐰',
    carnivore: '🦁',
    omnivore: '🐻',
    decomposer: '🍄',
    microbe: '🦠'
  };
  return emojis[type] || '❓';
}

interface SpeciesSummary {
  name: string;
  type: string;
  color: string;
  count: number;
}

function getSpeciesSummary(organisms: Organism[]): SpeciesSummary[] {
  const speciesMap = new Map<string, SpeciesSummary>();
  
  organisms.forEach(org => {
    const existing = speciesMap.get(org.species);
    if (existing) {
      existing.count++;
    } else {
      speciesMap.set(org.species, {
        name: org.species,
        type: org.type,
        color: org.color,
        count: 1
      });
    }
  });

  return Array.from(speciesMap.values()).sort((a, b) => b.count - a.count);
}
