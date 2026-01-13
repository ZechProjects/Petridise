// World Configuration Types
export interface WorldConfig {
  name: string;
  width: number;
  height: number;
  gravity: number;
  temperature: number; // Celsius
  humidity: number; // 0-100%
  compounds: Compounds;
  biome: BiomeType;
}

export interface Compounds {
  oxygen: number; // 0-100%
  water: number; // 0-100%
  nitrogen: number; // 0-100%
  carbon: number; // 0-100%
  minerals: number; // 0-100%
}

export type BiomeType = 
  | 'ocean'
  | 'forest'
  | 'desert'
  | 'tundra'
  | 'swamp'
  | 'volcanic'
  | 'grassland'
  | 'cave'
  | 'alien';

// Organism Types
export interface Organism {
  id: string;
  name: string; // Common/friendly name (e.g., "Spotted Floater")
  species: string; // Species name (e.g., "Floater")
  description?: string; // Short description of this organism
  ancestry?: string[]; // Evolution history - names of ancestors
  type: OrganismType;
  x: number;
  y: number;
  size: number;
  color: string;
  secondaryColor?: string; // For patterns/details
  energy: number;
  age: number;
  maxAge: number;
  speed: number;
  traits: Trait[];
  behavior: BehaviorType;
  locomotion: LocomotionType; // How the organism moves
  diet?: DietType;
  reproductionRate: number;
  generation?: number; // Which generation this organism first appeared
  // Runtime state (not saved)
  direction?: number; // Current facing direction in radians
  targetX?: number; // For pathfinding
  targetY?: number;
  animationPhase?: number; // For idle animations
}

export type OrganismType = 
  | 'plant'
  | 'herbivore'
  | 'carnivore'
  | 'omnivore'
  | 'decomposer'
  | 'microbe';

export type BehaviorType =
  | 'passive'
  | 'aggressive'
  | 'territorial'
  | 'social'
  | 'solitary'
  | 'migratory'
  | 'schooling'
  | 'ambush'
  | 'grazing';

export type DietType =
  | 'photosynthesis'
  | 'herbivore'
  | 'carnivore'
  | 'omnivore'
  | 'decomposer';

export type LocomotionType =
  | 'walking'
  | 'swimming'
  | 'flying'
  | 'hopping'
  | 'slithering'
  | 'burrowing'
  | 'floating'
  | 'crawling'
  | 'gliding'
  | 'sessile'; // For plants/stationary organisms

export interface Trait {
  name: string;
  value: number;
  description: string;
}

// Simulation State Types
export interface SimulationState {
  id: string;
  generation: number;
  tick: number;
  maxTicks: number;
  status: SimulationStatus;
  world: WorldConfig;
  organisms: Organism[];
  events: SimulationEvent[];
  statistics: SimulationStats;
}

export type SimulationStatus = 
  | 'configuring'
  | 'generating'
  | 'running'
  | 'paused'
  | 'evolving'
  | 'completed';

export interface SimulationStats {
  totalOrganisms: number;
  births: number;
  deaths: number;
  extinctions: string[];
  newSpecies: string[];
  dominantSpecies: string;
  biodiversityIndex: number;
}

// Events Types
export interface SimulationEvent {
  id: string;
  tick: number;
  type: EventType;
  title: string;
  description: string;
  affectedOrganisms: string[];
  significance: 'minor' | 'moderate' | 'major' | 'catastrophic';
}

export type EventType =
  | 'birth'
  | 'death'
  | 'evolution'
  | 'mutation'
  | 'migration'
  | 'disease'
  | 'extinction'
  | 'speciation'
  | 'climate_change'
  | 'natural_disaster'
  | 'symbiosis'
  | 'predation';

// API Response Types
export interface GenerateWorldResponse {
  world: WorldConfig;
  organisms: Organism[];
  backgroundTexture: string; // Base64 or URL
  narrative: string;
}

export interface EvolveResponse {
  organisms: Organism[];
  events: SimulationEvent[];
  worldChanges: Partial<WorldConfig>;
  narrative: string;
  shouldContinue: boolean;
  nextGenerationSuggestions: string[];
}

export interface GenerateTextureResponse {
  texture: string; // Base64 data URL
  description: string;
}

// UI State Types
export interface ConfigFormState {
  useRandom: boolean;
  worldConfig: Partial<WorldConfig>;
  simulationDuration: number; // in seconds
  realOrganismsOnly: boolean; // Only generate organisms that exist on Earth
}

// Organism Image Generation
export interface GenerateOrganismImageRequest {
  organism: Organism;
  worldBiome: string;
}

export interface GenerateOrganismImageResponse {
  imageData: string; // Base64 data URL
  description: string;
}

// Export/Import Types
export interface ExportedWorld {
  version: string; // For future compatibility
  exportedAt: string;
  generation: number;
  world: WorldConfig;
  organisms: Organism[];
  events: SimulationEvent[];
  stats: SimulationStats;
  narrative: string;
}
