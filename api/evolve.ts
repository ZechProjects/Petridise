import type { VercelRequest, VercelResponse } from '@vercel/node';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';

function getApiKey(req: VercelRequest): string | undefined {
  // Check for user-provided key in header first, then fall back to env
  const userKey = req.headers['x-gemini-api-key'] as string | undefined;
  return userKey || process.env.GEMINI_API_KEY;
}

interface EvolveRequest {
  generation: number;
  world: object;
  organisms: object[];
  events: object[];
  statistics: object;
  realOrganismsOnly?: boolean;
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
    const { generation, world, organisms, events, statistics, realOrganismsOnly } = req.body as EvolveRequest;

    const prompt = generateEvolvePrompt(generation, world, organisms, events, statistics, realOrganismsOnly);

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
    
    return res.status(200).json(evolveData);
  } catch (error) {
    console.error('Error evolving world:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function generateEvolvePrompt(
  generation: number,
  world: object,
  organisms: object[],
  events: object[],
  statistics: object,
  realOrganismsOnly?: boolean
): string {
  const organismInstruction = realOrganismsOnly
    ? `CRITICAL: ONLY use organisms that ACTUALLY EXIST ON EARTH. All organisms must be real species.
When new organisms appear or evolve, they must still be real Earth species appropriate for the biome.
Use subspecies or regional variants if needed (e.g., "Arctic Fox" from "Red Fox"), but never invent fictional creatures.
Track ancestry - each evolved organism should include its parent's name in the ancestry array.`
    : `IMPORTANT: Use COMMON, FRIENDLY NAMES for all organisms - like "Spotted Floater", "Crystal Muncher", "Swamp Hopper", etc.
When new species evolve, give them fun descriptive names based on their parent (e.g., "Swift Floater" evolved from "Spotted Floater").
Track ancestry - each evolved organism should include its parent's name in the ancestry array.`;

  return `You are an evolution AI for a life simulation called Petridise.
Analyze the current state of the simulation and generate the next generation.

${organismInstruction}

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
- Evolution of locomotion types (organisms might develop flight, swimming, burrowing abilities)

Return a JSON object with this exact structure:
{
  "organisms": [
    // Each organism should have: id, name (common friendly name), species, description, ancestry (array of ancestor names), 
    // generation (first generation this species appeared), type, x, y, size, color, secondaryColor, energy, age, maxAge, speed, traits, 
    // behavior (passive|aggressive|territorial|social|solitary|migratory|schooling|ambush|grazing),
    // locomotion (walking|swimming|flying|hopping|slithering|burrowing|floating|crawling|gliding|sessile),
    // diet, reproductionRate
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

IMPORTANT FOR VISUAL IMPRESSIVENESS:
- Maintain 20-35 organisms for an active simulation
- Include multiple organisms of social/schooling species (3-6 of the same species)
- Evolved organisms should have appropriate locomotion for their biome
- Use vibrant, contrasting colors and secondary colors for patterns
- Create dramatic events with major significance occasionally
- Make speeds between 1.5-3.5 for active movement

Be creative but scientifically plausible. Create dramatic moments and evolutionary breakthroughs.
Generate at least 2-5 significant events. If organisms are thriving, allow reproduction to increase population (up to ~35 organisms).
If organisms are struggling, show realistic die-offs and adaptations.`;
}
