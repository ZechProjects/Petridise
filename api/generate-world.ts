import type { VercelRequest, VercelResponse } from '@vercel/node';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';

function getApiKey(req: VercelRequest): string | undefined {
  // Check for user-provided key in header first, then fall back to env
  const userKey = req.headers['x-gemini-api-key'] as string | undefined;
  return userKey || process.env.GEMINI_API_KEY;
}

interface WorldConfigRequest {
  useRandom?: boolean;
  realOrganismsOnly?: boolean;
  worldConfig?: {
    name?: string;
    width?: number;
    height?: number;
    gravity?: number;
    temperature?: number;
    humidity?: number;
    compounds?: {
      oxygen?: number;
      water?: number;
      nitrogen?: number;
      carbon?: number;
      minerals?: number;
    };
    biome?: string;
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = getApiKey(req);
  if (!apiKey) {
    return res.status(400).json({ error: 'GEMINI_API_KEY not configured. Please provide your own API key.' });
  }

  try {
    const { useRandom, worldConfig, realOrganismsOnly } = req.body as WorldConfigRequest;

    const prompt = generatePrompt(useRandom, worldConfig, realOrganismsOnly);

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
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
    
    return res.status(200).json(worldData);
  } catch (error) {
    console.error('Error generating world:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function generatePrompt(useRandom?: boolean, worldConfig?: WorldConfigRequest['worldConfig'], realOrganismsOnly?: boolean): string {
  const organismInstruction = realOrganismsOnly 
    ? `CRITICAL: ONLY generate organisms that ACTUALLY EXIST ON EARTH. Use real species like "Ladybug", "Tree Frog", "Clownfish", "Mushroom", "Oak Tree", "Garden Snail", etc.
Do NOT invent fictional creatures. Each organism must be a real Earth species (plant, animal, fungus, or microbe) appropriate for the chosen biome.`
    : `IMPORTANT: Use COMMON, FRIENDLY NAMES for organisms - like "Spotted Floater", "Crystal Muncher", "Swamp Hopper", etc.
Avoid scientific Latin-style names. Make names fun, descriptive, and easy to remember.`;

  return `You are a world generation AI for a life simulation game called Petridise. 
Generate a complete starting environment with MANY diverse organisms in JSON format.
The simulation should be VISUALLY IMPRESSIVE and ACTIVE with lots of movement and interactions.

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
      "size": number (8-45 pixels),
      "color": "hex color string like #FF5733",
      "secondaryColor": "hex color string for patterns/details",
      "energy": number (60-100),
      "age": 0,
      "maxAge": number (200-800 ticks),
      "speed": number (1.0-4.0 - make things FASTER for visual interest),
      "traits": [
        {
          "name": "trait name",
          "value": number (0-100),
          "description": "what this trait does"
        }
      ],
      "behavior": "passive" | "aggressive" | "territorial" | "social" | "solitary" | "migratory" | "schooling" | "ambush" | "grazing",
      "locomotion": "walking" | "swimming" | "flying" | "hopping" | "slithering" | "burrowing" | "floating" | "crawling" | "gliding" | "sessile",
      "diet": "photosynthesis" | "herbivore" | "carnivore" | "omnivore" | "decomposer",
      "reproductionRate": number (0.02-0.08)
    }
  ],
  "narrative": "A creative 2-3 sentence description of this world and its ecosystem"
}

CRITICAL REQUIREMENTS FOR AN IMPRESSIVE SIMULATION:
1. Generate 20-30 diverse organisms for a lively ecosystem
2. Include MULTIPLE organisms of the same species (3-5 of social/schooling species) for group behaviors
3. Use varied locomotion types appropriate for the biome:
   - Ocean/Swamp: mostly "swimming", "floating", some "crawling"
   - Forest/Grassland: "walking", "flying", "hopping", "crawling", "slithering"
   - Desert: "walking", "burrowing", "slithering", "hopping"
   - Tundra: "walking", "flying", "swimming"
   - Cave: "crawling", "flying", "slithering", "burrowing"
   - Volcanic: "flying", "crawling", "hopping"
   - Alien: mix of all types including "gliding", "floating"
4. Plants should have locomotion: "sessile"
5. Include social/schooling behaviors for fish-like or herd animals (they look amazing in groups)
6. Use "ambush" for predators that hide and strike
7. Use "grazing" for peaceful herbivores
8. Make speeds between 1.5-3.5 for active movement (except plants)
9. Spread organisms across the ENTIRE world - don't cluster them
10. Use vibrant, contrasting colors for visual appeal
11. Create a balanced food chain with producers, primary consumers, and apex predators

${realOrganismsOnly 
    ? 'Use ONLY real Earth species appropriate for the biome. Include real plants, animals, fungi, and microbes that would naturally exist in this environment.'
    : `Make the organisms creative and unique with interesting traits that match the biome.
Use fun, memorable names that describe the creature (e.g., "Bubble Blower", "Spike Runner", "Glow Crawler").`}

Ensure organisms are placed at VARIED coordinates throughout the world dimensions for visual spread.`;
}
