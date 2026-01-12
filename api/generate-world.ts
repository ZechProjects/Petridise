import type { VercelRequest, VercelResponse } from '@vercel/node';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

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

  const basePrompt = `You are a world generation AI for a life simulation game called Petridise. 
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
    : `Make the organisms creative and unique with interesting traits that match the biome.
Use fun, memorable names that describe the creature (e.g., "Bubble Blower", "Spike Runner", "Glow Crawler").`}
Ensure organisms are placed at valid coordinates within the world dimensions.`;

  return basePrompt;
}
