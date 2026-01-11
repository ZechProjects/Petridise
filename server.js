import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
// Use Imagen 4 (fast version for quicker generation)
const IMAGEN_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-001:predict';

// Debug: show first/last chars of key
console.log('API Key loaded:', GEMINI_API_KEY ? `${GEMINI_API_KEY.slice(0,8)}...${GEMINI_API_KEY.slice(-4)}` : 'NOT FOUND');

async function createServer() {
  const app = express();
  
  app.use(cors());
  app.use(express.json());

  // Create Vite server in middleware mode
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa'
  });

  // API Routes
  
  // Generate World
  app.post('/api/generate-world', async (req, res) => {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY not configured. Set it in your environment.' });
    }

    try {
      const { useRandom, worldConfig, realOrganismsOnly } = req.body;
      const prompt = generateWorldPrompt(useRandom, worldConfig, realOrganismsOnly);

      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.8,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
            responseMimeType: "application/json"
          }
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Gemini API error:', error);
        return res.status(500).json({ error: 'Failed to generate world' });
      }

      const data = await response.json();
      const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!generatedText) {
        return res.status(500).json({ error: 'No response from Gemini' });
      }

      const worldData = JSON.parse(generatedText);
      return res.json(worldData);
    } catch (error) {
      console.error('Error generating world:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Evolve
  app.post('/api/evolve', async (req, res) => {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
    }

    try {
      const { generation, world, organisms, events, statistics, realOrganismsOnly } = req.body;
      const prompt = generateEvolvePrompt(generation, world, organisms, events, statistics, realOrganismsOnly);

      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.9,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
            responseMimeType: "application/json"
          }
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Gemini API error:', error);
        return res.status(500).json({ error: 'Failed to evolve world' });
      }

      const data = await response.json();
      const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!generatedText) {
        return res.status(500).json({ error: 'No response from Gemini' });
      }

      const evolveData = JSON.parse(generatedText);
      return res.json(evolveData);
    } catch (error) {
      console.error('Error evolving world:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Generate Texture using Imagen 3
  app.post('/api/generate-texture', async (req, res) => {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
    }

    try {
      const { biome, world, width = 1024, height = 768 } = req.body;
      const prompt = generateImagePrompt(biome, world);

      // Using the models.predict endpoint for Imagen
      const response = await fetch(`${IMAGEN_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [
            { prompt }
          ],
          parameters: {
            sampleCount: 1,
            aspectRatio: width > height ? '16:9' : (width < height ? '9:16' : '4:3')
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Imagen API error - Status:', response.status);
        console.error('Imagen API error - Body:', errorText);
        // Fallback to color-based texture if Imagen fails
        return res.json(generateFallbackTexture(biome, world));
      }

      const data = await response.json();
      console.log('Imagen API response keys:', Object.keys(data));
      
      // Extract base64 image from response - try multiple possible formats
      const generatedImage = data.generatedImages?.[0]?.image?.imageBytes ||
                            data.predictions?.[0]?.bytesBase64Encoded ||
                            data.images?.[0]?.bytesBase64Encoded;

      if (!generatedImage) {
        console.error('No image in Imagen response:', JSON.stringify(data).slice(0, 500));
        return res.json(generateFallbackTexture(biome, world));
      }

      return res.json({
        type: 'image',
        imageData: `data:image/png;base64,${generatedImage}`,
        prompt: prompt
      });
    } catch (error) {
      console.error('Error generating texture:', error);
      // Return fallback on error
      return res.json(generateFallbackTexture(req.body.biome, req.body.world));
    }
  });

  // Generate photo-realistic organism image using Imagen
  app.post('/api/generate-organism-image', async (req, res) => {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
    }

    try {
      const { organism, worldBiome } = req.body;
      const prompt = generateOrganismImagePrompt(organism, worldBiome);
      
      console.log('Generating organism image with prompt:', prompt);

      const response = await fetch(`${IMAGEN_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [
            { prompt }
          ],
          parameters: {
            sampleCount: 1,
            aspectRatio: '1:1'
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Imagen API error - Status:', response.status);
        console.error('Imagen API error - Body:', errorText);
        return res.status(500).json({ error: 'Failed to generate organism image' });
      }

      const data = await response.json();
      
      const generatedImage = data.generatedImages?.[0]?.image?.imageBytes ||
                            data.predictions?.[0]?.bytesBase64Encoded ||
                            data.images?.[0]?.bytesBase64Encoded;

      if (!generatedImage) {
        console.error('No image in Imagen response:', JSON.stringify(data).slice(0, 500));
        return res.status(500).json({ error: 'No image generated' });
      }

      return res.json({
        imageData: `data:image/png;base64,${generatedImage}`,
        description: prompt
      });
    } catch (error) {
      console.error('Error generating organism image:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Use vite's connect instance as middleware
  app.use(vite.middlewares);

  const PORT = 3000;
  app.listen(PORT, () => {
    console.log(`🧫 Petridise server running at http://localhost:${PORT}`);
    console.log(`   API Key configured: ${GEMINI_API_KEY ? '✓' : '✗ (set GEMINI_API_KEY env var)'}`);
  });
}

// Prompt generators
function generateWorldPrompt(useRandom, worldConfig, realOrganismsOnly) {
  const organismInstruction = realOrganismsOnly 
    ? `CRITICAL: ONLY generate organisms that ACTUALLY EXIST ON EARTH. Use real species like "Ladybug", "Tree Frog", "Clownfish", "Mushroom", "Oak Tree", "Garden Snail", etc.
Do NOT invent fictional creatures. Each organism must be a real Earth species (plant, animal, fungus, or microbe) appropriate for the chosen biome.`
    : `IMPORTANT: Use COMMON, FRIENDLY NAMES for organisms - like "Spotted Floater", "Crystal Muncher", "Swamp Hopper", etc.
Avoid scientific Latin-style names. Make names fun, descriptive, and easy to remember.`;

  return `You are a world generation AI for a life simulation game called Petridise. 
Generate a complete starting environment with organisms in JSON format.

${useRandom ? 'Create a completely random and unique world with interesting characteristics.' : 
`Use these world parameters as a starting point:
${JSON.stringify(worldConfig, null, 2)}`}

${organismInstruction}

Return a JSON object with this exact structure:
{
  "world": {
    "name": "string - creative name for this world",
    "width": number (800-1600),
    "height": number (600-1200),
    "gravity": number (0.1-2.0, where 1.0 is Earth-like),
    "temperature": number (-50 to 100 Celsius),
    "humidity": number (0-100 percentage),
    "compounds": {
      "oxygen": number (0-100),
      "water": number (0-100),
      "nitrogen": number (0-100),
      "carbon": number (0-100),
      "minerals": number (0-100)
    },
    "biome": "ocean" | "forest" | "desert" | "tundra" | "swamp" | "volcanic" | "grassland" | "cave" | "alien"
  },
  "organisms": [
    {
      "id": "unique string id",
      "name": "friendly common name like 'Fuzzy Bouncer' or 'Golden Drifter'",
      "species": "short species group name like 'Bouncers' or 'Drifters'",
      "description": "One sentence describing what makes this creature unique",
      "ancestry": [],
      "generation": 1,
      "type": "plant" | "herbivore" | "carnivore" | "omnivore" | "decomposer" | "microbe",
      "x": number (0 to world width),
      "y": number (0 to world height),
      "size": number (5-50 pixels),
      "color": "hex color string like #FF5733",
      "energy": number (50-100),
      "age": 0,
      "maxAge": number (100-1000 ticks),
      "speed": number (0.5-5.0),
      "traits": [
        {
          "name": "trait name",
          "value": number (0-100),
          "description": "what this trait does"
        }
      ],
      "behavior": "passive" | "aggressive" | "territorial" | "social" | "solitary" | "migratory",
      "diet": "photosynthesis" | "herbivore" | "carnivore" | "omnivore" | "decomposer",
      "reproductionRate": number (0.01-0.1)
    }
  ],
  "narrative": "A creative 2-3 sentence description of this world and its ecosystem"
}

Generate 8-15 diverse organisms that form a balanced ecosystem with producers, consumers, and decomposers.
${realOrganismsOnly 
  ? 'Use ONLY real Earth species appropriate for the biome. Include real plants, animals, fungi, and microbes that would naturally exist in this environment.'
  : 'Make the organisms creative and unique with interesting traits that match the biome.\nUse fun, memorable names that describe the creature (e.g., "Bubble Blower", "Spike Runner", "Glow Crawler").'}
Ensure organisms are placed at valid coordinates within the world dimensions.`;
}

function generateEvolvePrompt(generation, world, organisms, events, statistics, realOrganismsOnly) {
  const organismInstruction = realOrganismsOnly
    ? `CRITICAL: ONLY use organisms that ACTUALLY EXIST ON EARTH. All organisms must be real species.
When new organisms appear or evolve, they must still be real Earth species appropriate for the biome.
Use subspecies or regional variants if needed (e.g., "Arctic Fox" from "Red Fox"), but never invent fictional creatures.`
    : `IMPORTANT: Use COMMON, FRIENDLY NAMES for all organisms - like "Spotted Floater", "Crystal Muncher", "Swamp Hopper", etc.
When new species evolve, give them fun descriptive names based on their parent (e.g., "Swift Floater" evolved from "Spotted Floater").`;

  return `You are an evolution AI for a life simulation called Petridise.
Analyze the current state of the simulation and generate the next generation.

${organismInstruction}
Track ancestry - each evolved organism should include its parent's name in the ancestry array.

Current Generation: ${generation}
Current World State:
${JSON.stringify(world, null, 2)}

Surviving Organisms (${organisms.length} total):
${JSON.stringify(organisms, null, 2)}

Events that occurred this generation:
${JSON.stringify(events, null, 2)}

Statistics:
${JSON.stringify(statistics, null, 2)}

Based on this data, generate the evolved state for generation ${generation + 1}.
Consider:
- Natural selection based on organism traits and survival
- Possible mutations and evolution of surviving species
- New species that might emerge (with creative common names)
- Environmental changes based on organism activity
- Population dynamics and carrying capacity
- Possible disease outbreaks or natural disasters
- Symbiotic relationships that may form

Return a JSON object with this exact structure:
{
  "organisms": [
    // Each organism should have: id, name (common friendly name), species, description, ancestry (array of ancestor names), 
    // generation (first generation this species appeared), type, x, y, size, color, energy, age, maxAge, speed, traits, behavior, diet, reproductionRate
  ],
  "events": [
    {
      "id": "unique event id",
      "tick": 0,
      "type": "birth" | "death" | "evolution" | "mutation" | "migration" | "disease" | "extinction" | "speciation" | "climate_change" | "natural_disaster" | "symbiosis" | "predation",
      "title": "Short event title",
      "description": "Detailed description of what happened",
      "affectedOrganisms": ["list of organism ids affected"],
      "significance": "minor" | "moderate" | "major" | "catastrophic"
    }
  ],
  "worldChanges": {
    // Any changes to the world parameters (temperature, humidity, compounds, etc.)
    // Only include fields that changed
  },
  "narrative": "A 2-4 sentence story about what happened in this generation and what to expect next",
  "shouldContinue": boolean (true if the simulation should continue, false if all life is extinct or a major milestone was reached),
  "nextGenerationSuggestions": ["List of 2-3 interesting things that might happen next generation"]
}

Be creative but scientifically plausible. Create dramatic moments and evolutionary breakthroughs.
Generate at least 2-5 significant events. If organisms are thriving, allow reproduction to increase population (up to ~30 organisms).
If organisms are struggling, show realistic die-offs and adaptations.`;
}

function generateImagePrompt(biome, world) {
  const temp = world.temperature ?? 20;
  const humidity = world.humidity ?? 50;
  const water = world.compounds?.water ?? 50;
  
  // Determine color palette based on conditions
  let colorDesc = '';
  if (temp > 40) colorDesc = 'warm oranges, reds, and deep browns';
  else if (temp < 0) colorDesc = 'cool blues, whites, and icy cyans';
  else colorDesc = 'natural greens, earth tones, and soft blues';

  let textureType = '';
  if (humidity > 70 || water > 70) textureType = 'fluid, watery ripples and organic swirls';
  else if (humidity < 30 && water < 30) textureType = 'cracked, dusty, granular patterns';
  else textureType = 'smooth organic cellular patterns';

  // Build biome-specific texture descriptions
  const biomeTextures = {
    'ocean': 'deep water caustics, underwater light rays, subtle bubbles',
    'aquatic': 'pond water surface, algae patterns, lily pad shadows',
    'forest': 'moss texture, leaf litter, dappled sunlight on forest floor',
    'desert': 'sand dunes pattern, wind ripples, scattered pebbles',
    'tundra': 'frost crystals, ice patterns, snow texture',
    'swamp': 'murky water, floating debris, marsh grass shadows',
    'volcanic': 'cooling lava texture, ash patterns, obsidian glints',
    'grassland': 'grass blade patterns from above, wildflower dots',
    'cave': 'dark stone texture, mineral deposits, crystal formations',
    'alien': 'bioluminescent patterns, exotic crystalline structures, otherworldly organic shapes'
  };

  const biomeDetail = biomeTextures[biome?.toLowerCase()] || biomeTextures['forest'];

  return `Abstract ${biome} texture pattern for a 2D game background. 
Style: Flat digital illustration, seamless tileable texture, top-down view.
Colors: ${colorDesc}, muted and desaturated palette.
Pattern: ${textureType}, ${biomeDetail}.
Requirements: No realistic photographs, no 3D rendering, no perspective depth.
Abstract and stylized like a hand-painted game asset or watercolor wash.
Suitable as a subtle backdrop - not busy or distracting.
No text, no creatures, no objects - pure environmental texture only.`;
}

function generateOrganismImagePrompt(organism, worldBiome) {
  // Build a detailed description of the organism for photorealistic rendering
  const typeDescriptions = {
    'plant': 'plant organism, botanical illustration style',
    'herbivore': 'peaceful herbivorous creature, gentle eyes',
    'carnivore': 'predatory creature with sharp features, intense gaze',
    'omnivore': 'versatile creature with adaptive features',
    'decomposer': 'fungal or bacterial organism, organic decomposition specialist',
    'microbe': 'microscopic organism, cellular structures visible'
  };

  const biomeEnvironments = {
    'ocean': 'underwater environment, aquatic, bioluminescent depths',
    'forest': 'lush forest floor, dappled sunlight, green foliage',
    'desert': 'arid sandy environment, harsh sunlight, dry conditions',
    'tundra': 'frozen tundra, snow and ice, cold environment',
    'swamp': 'murky swamp waters, humid, dense vegetation',
    'volcanic': 'volcanic environment, heat resistant, ash and lava nearby',
    'grassland': 'open grassland, sunny meadow, waving grass',
    'cave': 'dark cave environment, stalactites, mysterious lighting',
    'alien': 'otherworldly alien planet, strange bioluminescent environment'
  };

  const typeDesc = typeDescriptions[organism.type] || 'mysterious creature';
  const envDesc = biomeEnvironments[worldBiome?.toLowerCase()] || 'natural environment';
  
  // Build trait description
  const traitList = organism.traits?.map(t => t.name).join(', ') || 'unique features';
  
  // Size description
  let sizeDesc = 'medium-sized';
  if (organism.size < 15) sizeDesc = 'tiny, microscopic';
  else if (organism.size < 25) sizeDesc = 'small';
  else if (organism.size > 40) sizeDesc = 'large, imposing';
  
  // Behavior description
  const behaviorDesc = {
    'passive': 'calm and docile appearance',
    'aggressive': 'fierce and intimidating stance',
    'territorial': 'alert and watchful posture',
    'social': 'friendly and approachable demeanor',
    'solitary': 'isolated and self-reliant look',
    'migratory': 'streamlined for travel'
  };

  const behaviorText = behaviorDesc[organism.behavior] || '';

  return `Photorealistic nature documentary photograph of a ${sizeDesc} ${typeDesc} called "${organism.name}".
Species: ${organism.species}. 
${organism.description ? `Description: ${organism.description}.` : ''}
Color: ${organism.color} dominant coloring.
Traits: ${traitList}.
Personality: ${behaviorText}.
Environment: ${envDesc}.
Style: National Geographic wildlife photography, studio quality, dramatic lighting.
Sharp focus on the creature, shallow depth of field, professional nature photography.
Highly detailed, lifelike textures, anatomically plausible fantasy creature design.`;
}

function generateFallbackTexture(biome, world) {
  // Fallback color-based texture when Imagen is unavailable
  const biomeColors = {
    'aquatic': { bg: '#1a3a4a', gradient: ['#1a3a4a', '#2d5a6a', '#3d7a8a'], pattern: '#4d9aaa' },
    'desert': { bg: '#8b7355', gradient: ['#8b7355', '#a08060', '#c4a882'], pattern: '#d4b892' },
    'forest': { bg: '#2d4a2d', gradient: ['#2d4a2d', '#3d5a3d', '#4d6a4d'], pattern: '#5d7a5d' },
    'tundra': { bg: '#a0b0c0', gradient: ['#a0b0c0', '#c0d0e0', '#e0f0ff'], pattern: '#ffffff' },
    'volcanic': { bg: '#3a2020', gradient: ['#3a2020', '#5a3030', '#7a4040'], pattern: '#aa5050' },
    'alien': { bg: '#2a1a3a', gradient: ['#2a1a3a', '#4a2a5a', '#6a3a7a'], pattern: '#8a4a9a' },
  };

  const colors = biomeColors[biome?.toLowerCase()] || biomeColors['forest'];
  
  return {
    type: 'fallback',
    backgroundColor: colors.bg,
    gradientColors: colors.gradient,
    patternType: 'organic',
    patternColor: colors.pattern,
    patternOpacity: 0.3,
    accentColors: [colors.pattern, colors.gradient[1]]
  };
}

createServer();
