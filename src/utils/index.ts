export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

export function randomRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export function randomInt(min: number, max: number): number {
  return Math.floor(randomRange(min, max + 1));
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Convert pixel size to real-world size based on organism type.
 * Scale: 1px ≈ 1mm for microbes, scaling up for larger organisms.
 */
export function pixelToRealSize(pixelSize: number, organismType?: string): { value: number; unit: string; display: string } {
  // Base scale: microbes are tiny (1px ≈ 0.1mm), larger organisms scale up
  const typeMultipliers: Record<string, number> = {
    microbe: 0.1,      // 5-50px → 0.5-5mm
    decomposer: 0.5,   // 5-50px → 2.5-25mm
    plant: 20,         // 5-50px → 10cm-1m
    herbivore: 10,     // 5-50px → 5-50cm
    carnivore: 15,     // 5-50px → 7.5-75cm
    omnivore: 12,      // 5-50px → 6-60cm
  };
  
  const multiplier = typeMultipliers[organismType || 'herbivore'] || 10;
  const sizeInMm = pixelSize * multiplier;
  
  if (sizeInMm < 10) {
    return { value: Math.round(sizeInMm * 10) / 10, unit: 'mm', display: `${(Math.round(sizeInMm * 10) / 10).toFixed(1)} mm` };
  } else if (sizeInMm < 1000) {
    const cm = sizeInMm / 10;
    return { value: Math.round(cm * 10) / 10, unit: 'cm', display: `${(Math.round(cm * 10) / 10).toFixed(1)} cm` };
  } else {
    const m = sizeInMm / 1000;
    return { value: Math.round(m * 100) / 100, unit: 'm', display: `${(Math.round(m * 100) / 100).toFixed(2)} m` };
  }
}

/**
 * Estimate organism weight based on size and type.
 * Uses rough volume calculation (sphere approximation) and density.
 */
export function estimateWeight(pixelSize: number, organismType?: string): { value: number; unit: string; display: string } {
  const realSize = pixelToRealSize(pixelSize, organismType);
  
  // Convert to cm for volume calculation
  let sizeInCm = realSize.value;
  if (realSize.unit === 'mm') sizeInCm = realSize.value / 10;
  if (realSize.unit === 'm') sizeInCm = realSize.value * 100;
  
  // Approximate as sphere: V = (4/3) * π * r³
  const radius = sizeInCm / 2;
  const volumeCm3 = (4 / 3) * Math.PI * Math.pow(radius, 3);
  
  // Density varies by organism type (g/cm³)
  const densities: Record<string, number> = {
    microbe: 1.05,     // Similar to water
    decomposer: 0.5,   // Fungal, lighter
    plant: 0.6,        // Plant tissue, lighter than water
    herbivore: 1.0,    // Average animal density
    carnivore: 1.05,   // Slightly denser (more muscle)
    omnivore: 1.0,     // Average
  };
  
  const density = densities[organismType || 'herbivore'] || 1.0;
  const weightInGrams = volumeCm3 * density;
  
  if (weightInGrams < 1) {
    const mg = weightInGrams * 1000;
    return { value: Math.round(mg * 10) / 10, unit: 'mg', display: `${(Math.round(mg * 10) / 10).toFixed(1)} mg` };
  } else if (weightInGrams < 1000) {
    return { value: Math.round(weightInGrams * 10) / 10, unit: 'g', display: `${(Math.round(weightInGrams * 10) / 10).toFixed(1)} g` };
  } else {
    const kg = weightInGrams / 1000;
    return { value: Math.round(kg * 100) / 100, unit: 'kg', display: `${(Math.round(kg * 100) / 100).toFixed(2)} kg` };
  }
}

/**
 * Compress an image for storage by resizing and reducing quality.
 * Takes a base64 data URL and returns a smaller compressed version.
 */
export function compressImageForStorage(
  dataUrl: string,
  maxWidth: number = 400,
  maxHeight: number = 300,
  quality: number = 0.7
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Calculate new dimensions maintaining aspect ratio
      let { width, height } = img;
      
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }
      
      // Create canvas and draw resized image
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert to JPEG with reduced quality for smaller size
      const compressed = canvas.toDataURL('image/jpeg', quality);
      resolve(compressed);
    };
    img.onerror = () => reject(new Error('Failed to load image for compression'));
    img.src = dataUrl;
  });
}
