import type { VercelRequest, VercelResponse } from '@vercel/node';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// Use Imagen 4 (fast version for quicker generation)
const IMAGEN_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-001:predict';

interface Organism {
  id: string;
  name: string;
  species: string;
  description?: string;
  type: string;
  size: number;
  color: string;
  traits?: Array<{ name: string; value: number; description: string }>;
  behavior?: string;
  diet?: string;
}

interface OrganismImageRequest {
  organism: Organism;
  worldBiome: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }

  try {
    const { organism, worldBiome } = req.body as OrganismImageRequest;
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

    return res.status(200).json({
      imageData: `data:image/png;base64,${generatedImage}`,
      description: prompt
    });
  } catch (error) {
    console.error('Error generating organism image:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function generateOrganismImagePrompt(organism: Organism, worldBiome: string): string {
  // Build a detailed description of the organism for photorealistic rendering
  const typeDescriptions: Record<string, string> = {
    'plant': 'plant organism, botanical illustration style',
    'herbivore': 'peaceful herbivorous creature, gentle eyes',
    'carnivore': 'predatory creature with sharp features, intense gaze',
    'omnivore': 'versatile creature with adaptive features',
    'decomposer': 'fungal or bacterial organism, organic decomposition specialist',
    'microbe': 'microscopic organism, cellular structures visible'
  };

  const biomeEnvironments: Record<string, string> = {
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
  const behaviorDesc: Record<string, string> = {
    'passive': 'calm and docile appearance',
    'aggressive': 'fierce and intimidating stance',
    'territorial': 'alert and watchful posture',
    'social': 'friendly and approachable demeanor',
    'solitary': 'isolated and self-reliant look',
    'migratory': 'streamlined for travel'
  };

  const behaviorText = behaviorDesc[organism.behavior || ''] || '';

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
