import type { VercelRequest, VercelResponse } from '@vercel/node';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// Use Imagen 4 (fast version for quicker generation)
const IMAGEN_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-001:predict';

interface TextureRequest {
  biome: string;
  world: {
    name?: string;
    temperature?: number;
    humidity?: number;
    compounds?: {
      water?: number;
      oxygen?: number;
    };
  };
  width?: number;
  height?: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }

  try {
    const { biome, world, width = 1024, height = 768 } = req.body as TextureRequest;

    const prompt = generateImagePrompt(biome, world);

    // Using the models.predict endpoint for Imagen
    const response = await fetch(`${IMAGEN_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
      const error = await response.text();
      console.error('Imagen API error:', error);
      // Fallback to color-based texture if Imagen fails
      return res.status(200).json(generateFallbackTexture(biome, world));
    }

    const data = await response.json();
    
    // Extract base64 image from response - try multiple possible formats
    const generatedImage = data.generatedImages?.[0]?.image?.imageBytes ||
                          data.predictions?.[0]?.bytesBase64Encoded ||
                          data.images?.[0]?.bytesBase64Encoded;

    if (!generatedImage) {
      console.error('No image in Imagen response:', JSON.stringify(data).slice(0, 500));
      return res.status(200).json(generateFallbackTexture(biome, world));
    }

    return res.status(200).json({
      type: 'image',
      imageData: `data:image/png;base64,${generatedImage}`,
      prompt: prompt
    });
  } catch (error) {
    console.error('Error generating texture:', error);
    // Return fallback on error
    return res.status(200).json(generateFallbackTexture(req.body.biome, req.body.world));
  }
}

function generateImagePrompt(biome: string, world: TextureRequest['world']): string {
  const temp = world.temperature ?? 20;
  const humidity = world.humidity ?? 50;
  
  // Build color palette based on temperature
  let colorPalette = '';
  if (temp > 40) colorPalette = 'warm orange and red tones';
  else if (temp < 0) colorPalette = 'cool blue and white tones';
  else colorPalette = 'natural earth tones, greens and browns';

  // Texture type based on humidity
  let textureType = '';
  if (humidity > 70) textureType = 'fluid, organic, flowing patterns';
  else if (humidity < 30) textureType = 'cracked, granular, dusty patterns';
  else textureType = 'smooth cellular patterns';

  // Biome-specific texture descriptions
  const biomeTextures: Record<string, string> = {
    'aquatic': 'water caustics texture, rippling light patterns, deep blue-green gradient',
    'forest': 'moss texture, leaf litter pattern, dappled green surface',
    'desert': 'sand grain texture, tan and beige gradients, subtle dune ripples',
    'volcanic': 'lava rock texture, dark basalt with orange cracks, molten highlights',
    'arctic': 'ice crystal texture, frost patterns, pale blue-white surface',
    'swamp': 'murky water texture, algae patterns, dark green-brown gradients',
    'grassland': 'grass blade texture pattern, yellow-green gradient surface',
    'cave': 'stone texture, mineral deposits, dark grey with crystal highlights'
  };

  const biomeTexture = biomeTextures[biome.toLowerCase()] || 'organic cellular texture, natural gradient';

  return `Abstract texture pattern for game background. ${biomeTexture}. 
${colorPalette}. ${textureType}.
Style: flat digital illustration, hand-painted game asset, stylized texture.
Requirements: seamless tileable texture, soft gradients, no distinct objects or creatures.
This is a subtle backdrop - not busy or distracting. Minimal detail.
No realistic photographs, no 3D rendering, no text labels.`;
}

function generateFallbackTexture(biome: string, world: TextureRequest['world']) {
  // Fallback color-based texture when Imagen is unavailable
  const biomeColors: Record<string, { bg: string; gradient: string[]; pattern: string }> = {
    'aquatic': { bg: '#1a3a4a', gradient: ['#1a3a4a', '#2d5a6a', '#3d7a8a'], pattern: '#4d9aaa' },
    'desert': { bg: '#8b7355', gradient: ['#8b7355', '#a08060', '#c4a882'], pattern: '#d4b892' },
    'forest': { bg: '#2d4a2d', gradient: ['#2d4a2d', '#3d5a3d', '#4d6a4d'], pattern: '#5d7a5d' },
    'tundra': { bg: '#a0b0c0', gradient: ['#a0b0c0', '#c0d0e0', '#e0f0ff'], pattern: '#ffffff' },
    'volcanic': { bg: '#3a2020', gradient: ['#3a2020', '#5a3030', '#7a4040'], pattern: '#aa5050' },
    'alien': { bg: '#2a1a3a', gradient: ['#2a1a3a', '#4a2a5a', '#6a3a7a'], pattern: '#8a4a9a' },
  };

  const colors = biomeColors[biome.toLowerCase()] || biomeColors['forest'];
  
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
