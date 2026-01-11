import Phaser from 'phaser';
import { Organism, WorldConfig } from '@/types';

// Fallback texture config (color-based)
export interface FallbackTextureConfig {
  type: 'fallback';
  backgroundColor: string;
  gradientColors: string[];
  patternType: 'dots' | 'waves' | 'cellular' | 'organic' | 'crystalline' | 'cloudy';
  patternColor: string;
  patternOpacity: number;
  accentColors: string[];
}

// Image-based texture config (from Imagen)
export interface ImageTextureConfig {
  type: 'image';
  imageData: string; // Base64 data URL
  prompt: string;
}

// Union type for texture config
export type TextureConfig = FallbackTextureConfig | ImageTextureConfig;

export interface SimulationCallbacks {
  onTick: (tick: number) => void;
  onOrganismUpdate: (organisms: Organism[]) => void;
  onSimulationComplete: () => void;
  onOrganismClick?: (organism: Organism) => void;
}

export class MainScene extends Phaser.Scene {
  private organisms: Map<string, Phaser.GameObjects.Container> = new Map();
  private organismData: Map<string, Organism> = new Map();
  private worldConfig: WorldConfig | null = null;
  private textureConfig: TextureConfig | null = null;
  private currentTick: number = 0;
  private maxTicks: number = 1000;
  private isRunning: boolean = false;
  private isAquariumMode = false; // Keep organisms moving without tick updates
  private tickTimer: Phaser.Time.TimerEvent | null = null;
  private aquariumTimer: Phaser.Time.TimerEvent | null = null;
  private callbacks: SimulationCallbacks | null = null;
  private background: Phaser.GameObjects.Graphics | null = null;
  private backgroundImage: Phaser.GameObjects.Image | null = null;

  public get aquariumMode(): boolean {
    return this.isAquariumMode;
  }

  constructor() {
    super({ key: 'MainScene' });
  }

  init(data: { 
    world: WorldConfig; 
    organisms: Organism[]; 
    texture: TextureConfig;
    maxTicks: number;
    callbacks: SimulationCallbacks;
  }) {
    console.log('MainScene.init:', data?.organisms?.length, 'organisms,', 
      data?.texture?.type, 'texture');
    
    this.worldConfig = data?.world ?? null;
    this.textureConfig = data?.texture ?? null;
    this.maxTicks = data?.maxTicks ?? 1000;
    this.callbacks = data?.callbacks ?? null;
    this.currentTick = 0;
    this.isRunning = false;
    
    // Store organism data
    this.organismData.clear();
    if (data?.organisms) {
      data.organisms.forEach(org => {
        this.organismData.set(org.id, { ...org });
      });
    }
  }

  preload() {
    // Load image texture if available
    if (this.textureConfig?.type === 'image' && this.textureConfig.imageData) {
      this.load.image('background-imagen', this.textureConfig.imageData);
    }
  }

  create() {
    // Enable depth sorting for this scene
    this.children.sortChildrenFlag = true;
    
    this.createBackground();
    this.createOrganisms();
    this.startSimulation();
    
    // Debug: log what was created
    console.log('MainScene created:', {
      organisms: this.organisms.size,
      background: this.backgroundImage ? 'image' : (this.background ? 'graphics' : 'none'),
      worldSize: this.worldConfig ? `${this.worldConfig.width}x${this.worldConfig.height}` : 'unknown'
    });
  }

  private createBackground() {
    if (!this.textureConfig) return;

    // Use actual game canvas size, not world config
    const width = this.scale.width;
    const height = this.scale.height;

    // Check if we have an image-based texture from Imagen
    if (this.textureConfig.type === 'image') {
      this.createImageBackground(width, height);
    } else {
      // Use fallback color-based texture
      this.createFallbackBackground(width, height, this.textureConfig);
    }
  }

  private createImageBackground(width: number, height: number) {
    // Check if the texture was loaded successfully
    if (this.textures.exists('background-imagen')) {
      this.backgroundImage = this.add.image(width / 2, height / 2, 'background-imagen');
      
      // Scale image to fit the world dimensions
      const scaleX = width / this.backgroundImage.width;
      const scaleY = height / this.backgroundImage.height;
      const scale = Math.max(scaleX, scaleY); // Cover the entire area
      this.backgroundImage.setScale(scale);
      
      // Send to back - use very low depth to ensure it's behind everything
      this.backgroundImage.setDepth(-1000);
      console.log('Background image created with depth:', this.backgroundImage.depth);
    } else {
      // Fallback to a solid color if image didn't load
      console.log('Background image texture not found, using fallback');
      this.background = this.add.graphics();
      this.background.fillStyle(0x1a3a4a, 1);
      this.background.fillRect(0, 0, width, height);
      this.background.setDepth(-1000);
    }
  }

  private createFallbackBackground(width: number, height: number, config: FallbackTextureConfig) {
    this.background = this.add.graphics();
    this.background.setDepth(-1000);

    // Draw gradient background
    const bgColor = Phaser.Display.Color.HexStringToColor(config.backgroundColor);
    this.background.fillStyle(bgColor.color, 1);
    this.background.fillRect(0, 0, width, height);

    // Add gradient overlay
    if (config.gradientColors.length > 1) {
      const gradientColors = config.gradientColors.map(c => 
        Phaser.Display.Color.HexStringToColor(c).color
      );
      
      for (let i = 0; i < height; i++) {
        const ratio = i / height;
        const colorIndex = Math.floor(ratio * (gradientColors.length - 1));
        const nextIndex = Math.min(colorIndex + 1, gradientColors.length - 1);
        const localRatio = (ratio * (gradientColors.length - 1)) - colorIndex;
        
        const color = Phaser.Display.Color.Interpolate.ColorWithColor(
          Phaser.Display.Color.IntegerToColor(gradientColors[colorIndex]),
          Phaser.Display.Color.IntegerToColor(gradientColors[nextIndex]),
          100,
          localRatio * 100
        );
        
        this.background.lineStyle(1, Phaser.Display.Color.GetColor(color.r, color.g, color.b), 0.3);
        this.background.lineBetween(0, i, width, i);
      }
    }

    // Add pattern based on type
    this.addPattern(config);
  }

  private addPattern(config?: FallbackTextureConfig) {
    const textureConfig = config || (this.textureConfig?.type === 'fallback' ? this.textureConfig : null);
    if (!textureConfig || !this.worldConfig || !this.background) return;

    const { width, height } = this.worldConfig;
    const patternColor = Phaser.Display.Color.HexStringToColor(textureConfig.patternColor).color;

    switch (textureConfig.patternType) {
      case 'dots':
        this.addDotsPattern(width, height, patternColor);
        break;
      case 'waves':
        this.addWavesPattern(width, height, patternColor);
        break;
      case 'cellular':
        this.addCellularPattern(width, height, patternColor);
        break;
      case 'organic':
        this.addOrganicPattern(width, height, patternColor);
        break;
      case 'crystalline':
        this.addCrystallinePattern(width, height, patternColor);
        break;
      case 'cloudy':
        this.addCloudyPattern(width, height, patternColor);
        break;
    }
  }

  private getPatternOpacity(): number {
    if (this.textureConfig?.type === 'fallback') {
      return this.textureConfig.patternOpacity;
    }
    return 0.3; // Default opacity
  }

  private addDotsPattern(width: number, height: number, color: number) {
    if (!this.background) return;
    const opacity = this.getPatternOpacity();
    const spacing = 30;
    for (let x = spacing; x < width; x += spacing) {
      for (let y = spacing; y < height; y += spacing) {
        const offset = Math.random() * 10 - 5;
        this.background.fillStyle(color, opacity * Math.random());
        this.background.fillCircle(x + offset, y + offset, 2 + Math.random() * 3);
      }
    }
  }

  private addWavesPattern(width: number, height: number, color: number) {
    if (!this.background) return;
    const opacity = this.getPatternOpacity();
    for (let y = 0; y < height; y += 20) {
      this.background.lineStyle(2, color, opacity);
      this.background.beginPath();
      for (let x = 0; x < width; x += 5) {
        const waveY = y + Math.sin(x * 0.02) * 10;
        if (x === 0) {
          this.background.moveTo(x, waveY);
        } else {
          this.background.lineTo(x, waveY);
        }
      }
      this.background.strokePath();
    }
  }

  private addCellularPattern(width: number, height: number, color: number) {
    if (!this.background) return;
    const opacity = this.getPatternOpacity();
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < 50; i++) {
      points.push({ x: Math.random() * width, y: Math.random() * height });
    }
    points.forEach(point => {
      this.background!.lineStyle(1, color, opacity);
      this.background!.strokeCircle(point.x, point.y, 20 + Math.random() * 40);
    });
  }

  private addOrganicPattern(width: number, height: number, color: number) {
    if (!this.background) return;
    const opacity = this.getPatternOpacity();
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const size = 10 + Math.random() * 30;
      this.background.fillStyle(color, opacity * 0.5);
      this.background.fillEllipse(x, y, size, size * (0.5 + Math.random() * 0.5));
    }
  }

  private addCrystallinePattern(width: number, height: number, color: number) {
    if (!this.background) return;
    const opacity = this.getPatternOpacity();
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const points: Phaser.Geom.Point[] = [];
      const sides = 4 + Math.floor(Math.random() * 4);
      for (let j = 0; j < sides; j++) {
        const angle = (j / sides) * Math.PI * 2;
        const radius = 20 + Math.random() * 30;
        points.push(new Phaser.Geom.Point(
          x + Math.cos(angle) * radius,
          y + Math.sin(angle) * radius
        ));
      }
      this.background.lineStyle(1, color, opacity);
      this.background.strokePoints(points, true);
    }
  }

  private addCloudyPattern(width: number, height: number, color: number) {
    if (!this.background) return;
    const opacity = this.getPatternOpacity();
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      this.background.fillStyle(color, opacity * 0.3);
      for (let j = 0; j < 5; j++) {
        const offsetX = (Math.random() - 0.5) * 40;
        const offsetY = (Math.random() - 0.5) * 20;
        this.background.fillCircle(x + offsetX, y + offsetY, 10 + Math.random() * 20);
      }
    }
  }

  private createOrganisms() {
    this.organisms.forEach(container => container.destroy());
    this.organisms.clear();

    const canvasWidth = this.scale.width;
    const canvasHeight = this.scale.height;
    const worldWidth = this.worldConfig?.width ?? canvasWidth;
    const worldHeight = this.worldConfig?.height ?? canvasHeight;
    
    // Scale factor to map world coords to canvas coords
    const scaleX = canvasWidth / worldWidth;
    const scaleY = canvasHeight / worldHeight;

    console.log('Creating', this.organismData.size, 'organisms. Canvas:', 
      canvasWidth, 'x', canvasHeight, 'Scale:', scaleX.toFixed(2), scaleY.toFixed(2));
    
    this.organismData.forEach((org, id) => {
      // Scale organism positions to fit canvas
      org.x = org.x * scaleX;
      org.y = org.y * scaleY;
      
      // Ensure within bounds
      const padding = org.size / 2;
      org.x = Phaser.Math.Clamp(org.x, padding, canvasWidth - padding);
      org.y = Phaser.Math.Clamp(org.y, padding, canvasHeight - padding);
      
      const container = this.createOrganismSprite(org);
      this.organisms.set(id, container);
    });
    
    console.log('Organisms created. Count:', this.organisms.size);
  }

  private createOrganismSprite(org: Organism): Phaser.GameObjects.Container {
    const container = this.add.container(org.x, org.y);
    
    // Set depth - organisms should always be above background (which is at -1000)
    container.setDepth(100 + Math.floor(org.y));
    
    // Create a graphics object
    const graphics = this.add.graphics();
    const color = Phaser.Display.Color.HexStringToColor(org.color).color;
    
    // Draw the organism based on type
    switch (org.type) {
      case 'plant':
        this.drawPlant(graphics, org.size, color);
        break;
      case 'herbivore':
        this.drawHerbivore(graphics, org.size, color);
        break;
      case 'carnivore':
        this.drawCarnivore(graphics, org.size, color);
        break;
      case 'omnivore':
        this.drawOmnivore(graphics, org.size, color);
        break;
      case 'decomposer':
        this.drawDecomposer(graphics, org.size, color);
        break;
      case 'microbe':
        this.drawMicrobe(graphics, org.size, color);
        break;
      default:
        // Simple circle fallback
        graphics.fillStyle(color, 1);
        graphics.fillCircle(0, 0, Math.max(org.size / 2, 8));
    }

    container.add(graphics);
    
    // Add energy indicator
    const energyBar = this.add.graphics();
    this.updateEnergyBar(energyBar, org);
    container.add(energyBar);
    container.setData('energyBar', energyBar);
    container.setData('organism', org);

    // Add name label (hidden by default, shown on hover)
    const nameLabel = this.add.text(0, -org.size / 2 - 20, org.name, {
      fontSize: '12px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      padding: { x: 6, y: 3 },
      align: 'center'
    });
    nameLabel.setOrigin(0.5, 1);
    nameLabel.setVisible(false);
    container.add(nameLabel);
    container.setData('nameLabel', nameLabel);

    // Add invisible hit area for better click/hover detection
    const hitSize = Math.max(org.size, 30);
    const hitArea = this.add.graphics();
    hitArea.fillStyle(0xffffff, 0.001); // Nearly invisible but captures input
    hitArea.fillCircle(0, 0, hitSize);
    container.add(hitArea);
    container.sendToBack(hitArea); // Put behind other graphics but still in container
    
    // Set up interactive area on the container
    container.setSize(hitSize * 2, hitSize * 2);
    container.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-hitSize, -hitSize, hitSize * 2, hitSize * 2),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true
    });
    
    container.on('pointerdown', () => {
      console.log('Organism clicked:', org.name);
      if (this.callbacks?.onOrganismClick) {
        const currentOrg = this.organismData.get(org.id);
        if (currentOrg) {
          this.callbacks.onOrganismClick(currentOrg);
        }
      }
    });

    container.on('pointerover', () => {
      container.setScale(1.15);
      nameLabel.setVisible(true);
    });

    container.on('pointerout', () => {
      container.setScale(1.0);
      nameLabel.setVisible(false);
    });

    return container;
  }

  private drawPlant(graphics: Phaser.GameObjects.Graphics, size: number, color: number) {
    // Draw a plant-like shape
    graphics.fillStyle(color, 1);
    graphics.fillCircle(0, 0, size / 3);
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const x = Math.cos(angle) * size / 2;
      const y = Math.sin(angle) * size / 2;
      graphics.fillCircle(x, y, size / 4);
    }
  }

  private drawHerbivore(graphics: Phaser.GameObjects.Graphics, size: number, color: number) {
    graphics.fillStyle(color, 1);
    graphics.fillEllipse(0, 0, size, size * 0.7);
    // Eyes
    graphics.fillStyle(0xFFFFFF, 1);
    graphics.fillCircle(size / 4, -size / 6, size / 8);
    graphics.fillStyle(0x000000, 1);
    graphics.fillCircle(size / 4 + 1, -size / 6, size / 16);
  }

  private drawCarnivore(graphics: Phaser.GameObjects.Graphics, size: number, color: number) {
    graphics.fillStyle(color, 1);
    // Triangular body
    graphics.fillTriangle(-size / 2, size / 3, size / 2, 0, -size / 2, -size / 3);
    // Eye
    graphics.fillStyle(0xFF0000, 1);
    graphics.fillCircle(size / 4, 0, size / 8);
  }

  private drawOmnivore(graphics: Phaser.GameObjects.Graphics, size: number, color: number) {
    graphics.fillStyle(color, 1);
    graphics.fillRoundedRect(-size / 2, -size / 2, size, size, size / 4);
    // Eyes
    graphics.fillStyle(0xFFFFFF, 1);
    graphics.fillCircle(size / 6, -size / 6, size / 10);
    graphics.fillCircle(-size / 6, -size / 6, size / 10);
  }

  private drawDecomposer(graphics: Phaser.GameObjects.Graphics, size: number, color: number) {
    graphics.fillStyle(color, 0.8);
    // Blob shape
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const x = Math.cos(angle) * size / 3;
      const y = Math.sin(angle) * size / 3;
      graphics.fillCircle(x, y, size / 4);
    }
  }

  private drawMicrobe(graphics: Phaser.GameObjects.Graphics, size: number, color: number) {
    graphics.fillStyle(color, 0.9);
    graphics.fillCircle(0, 0, size / 2);
    // Flagella
    graphics.lineStyle(1, color, 0.7);
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 + Math.PI;
      graphics.beginPath();
      graphics.moveTo(0, 0);
      const length = size;
      for (let j = 0; j < 10; j++) {
        const x = Math.cos(angle) * (j / 10) * length + Math.sin(j) * 3;
        const y = Math.sin(angle) * (j / 10) * length + Math.cos(j) * 3;
        graphics.lineTo(x, y);
      }
      graphics.strokePath();
    }
  }

  private updateEnergyBar(graphics: Phaser.GameObjects.Graphics, org: Organism) {
    graphics.clear();
    const barWidth = org.size;
    const barHeight = 3;
    const yOffset = -org.size / 2 - 8;
    
    // Background
    graphics.fillStyle(0x333333, 0.8);
    graphics.fillRect(-barWidth / 2, yOffset, barWidth, barHeight);
    
    // Energy fill
    const energyPercent = org.energy / 100;
    const fillColor = energyPercent > 0.5 ? 0x00FF00 : energyPercent > 0.25 ? 0xFFFF00 : 0xFF0000;
    graphics.fillStyle(fillColor, 1);
    graphics.fillRect(-barWidth / 2, yOffset, barWidth * energyPercent, barHeight);
  }

  private startSimulation() {
    this.isRunning = true;
    this.tickTimer = this.time.addEvent({
      delay: 50, // 20 ticks per second
      callback: this.onTick,
      callbackScope: this,
      loop: true
    });
  }

  private onTick() {
    if (!this.isRunning) return;

    this.currentTick++;
    
    // Update organisms
    this.updateOrganisms();
    
    // Notify callback
    if (this.callbacks) {
      this.callbacks.onTick(this.currentTick);
      this.callbacks.onOrganismUpdate(Array.from(this.organismData.values()));
    }

    // Check if simulation complete
    if (this.currentTick >= this.maxTicks) {
      this.stopSimulation();
    }
  }

  private updateOrganisms() {
    // Use canvas dimensions for bounds, not world config
    const width = this.scale.width;
    const height = this.scale.height;
    const gravity = this.worldConfig?.gravity ?? 1;

    this.organismData.forEach((org, id) => {
      const container = this.organisms.get(id);
      if (!container) return;

      // Move based on type and behavior
      if (org.type !== 'plant') {
        const movement = this.calculateMovement(org);
        org.x += movement.x;
        org.y += movement.y;

        // Apply gravity influence
        org.y += (gravity - 1) * 0.1;

        // Clamp to boundaries with padding for organism size
        const padding = org.size / 2;
        org.x = Phaser.Math.Clamp(org.x, padding, width - padding);
        org.y = Phaser.Math.Clamp(org.y, padding, height - padding);

        // Bounce off edges by reversing direction
        if (org.x <= padding || org.x >= width - padding) {
          org.speed = Math.abs(org.speed); // Keep speed positive, direction handled in movement
        }
        if (org.y <= padding || org.y >= height - padding) {
          org.speed = Math.abs(org.speed);
        }

        // Update container position with smooth lerp
        container.x = Phaser.Math.Linear(container.x, org.x, 0.1);
        container.y = Phaser.Math.Linear(container.y, org.y, 0.1);
        
        // Update depth based on y position for proper layering (base of 100 to stay above background)
        container.setDepth(100 + Math.floor(container.y));
      }

      // Update energy
      org.energy -= 0.05;
      if (org.type === 'plant') {
        // Plants gain energy from "photosynthesis"
        org.energy += 0.1;
      }
      org.energy = Phaser.Math.Clamp(org.energy, 0, 100);

      // Update age
      org.age += 1;

      // Update energy bar
      const energyBar = container.getData('energyBar') as Phaser.GameObjects.Graphics;
      if (energyBar) {
        this.updateEnergyBar(energyBar, org);
      }

      // Check for death
      if (org.energy <= 0 || org.age >= org.maxAge) {
        this.handleOrganismDeath(id);
      }
    });

    // Check for interactions
    this.checkInteractions();
  }

  private calculateMovement(org: Organism): { x: number; y: number } {
    const speed = org.speed;
    let dx = 0;
    let dy = 0;

    switch (org.behavior) {
      case 'passive':
        // Random wandering
        dx = (Math.random() - 0.5) * speed;
        dy = (Math.random() - 0.5) * speed;
        break;
      case 'aggressive':
        // Move toward nearest prey
        const prey = this.findNearestPrey(org);
        if (prey) {
          const angle = Math.atan2(prey.y - org.y, prey.x - org.x);
          dx = Math.cos(angle) * speed;
          dy = Math.sin(angle) * speed;
        } else {
          dx = (Math.random() - 0.5) * speed;
          dy = (Math.random() - 0.5) * speed;
        }
        break;
      case 'territorial':
        // Stay in area but move around
        dx = (Math.random() - 0.5) * speed * 0.5;
        dy = (Math.random() - 0.5) * speed * 0.5;
        break;
      case 'social':
        // Move toward others of same species
        const ally = this.findNearestAlly(org);
        if (ally) {
          const angle = Math.atan2(ally.y - org.y, ally.x - org.x);
          dx = Math.cos(angle) * speed * 0.5;
          dy = Math.sin(angle) * speed * 0.5;
        }
        dx += (Math.random() - 0.5) * speed * 0.5;
        dy += (Math.random() - 0.5) * speed * 0.5;
        break;
      case 'solitary':
        // Move away from others
        const nearest = this.findNearestOrganism(org);
        if (nearest && this.getDistance(org, nearest) < 100) {
          const angle = Math.atan2(org.y - nearest.y, org.x - nearest.x);
          dx = Math.cos(angle) * speed;
          dy = Math.sin(angle) * speed;
        } else {
          dx = (Math.random() - 0.5) * speed;
          dy = (Math.random() - 0.5) * speed;
        }
        break;
      case 'migratory':
        // Move in consistent direction with occasional change
        const migrationAngle = (this.currentTick * 0.01) + (parseInt(org.id, 36) % 10);
        dx = Math.cos(migrationAngle) * speed;
        dy = Math.sin(migrationAngle) * speed * 0.5;
        break;
    }

    return { x: dx, y: dy };
  }

  private findNearestPrey(predator: Organism): Organism | null {
    let nearest: Organism | null = null;
    let minDist = Infinity;

    this.organismData.forEach(org => {
      if (org.id === predator.id) return;
      if (predator.type === 'carnivore' && (org.type === 'herbivore' || org.type === 'omnivore')) {
        const dist = this.getDistance(predator, org);
        if (dist < minDist) {
          minDist = dist;
          nearest = org;
        }
      }
    });

    return nearest;
  }

  private findNearestAlly(org: Organism): Organism | null {
    let nearest: Organism | null = null;
    let minDist = Infinity;

    this.organismData.forEach(other => {
      if (other.id === org.id) return;
      if (other.species === org.species) {
        const dist = this.getDistance(org, other);
        if (dist < minDist) {
          minDist = dist;
          nearest = other;
        }
      }
    });

    return nearest;
  }

  private findNearestOrganism(org: Organism): Organism | null {
    let nearest: Organism | null = null;
    let minDist = Infinity;

    this.organismData.forEach(other => {
      if (other.id === org.id) return;
      const dist = this.getDistance(org, other);
      if (dist < minDist) {
        minDist = dist;
        nearest = other;
      }
    });

    return nearest;
  }

  private getDistance(a: Organism, b: Organism): number {
    return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
  }

  private checkInteractions() {
    const organisms = Array.from(this.organismData.values());
    
    for (let i = 0; i < organisms.length; i++) {
      for (let j = i + 1; j < organisms.length; j++) {
        const a = organisms[i];
        const b = organisms[j];
        const dist = this.getDistance(a, b);
        
        if (dist < (a.size + b.size) / 2) {
          this.handleInteraction(a, b);
        }
      }
    }
  }

  private handleInteraction(a: Organism, b: Organism) {
    // Predation
    if (a.type === 'carnivore' && (b.type === 'herbivore' || b.type === 'plant')) {
      a.energy = Math.min(100, a.energy + 20);
      b.energy -= 50;
    } else if (b.type === 'carnivore' && (a.type === 'herbivore' || a.type === 'plant')) {
      b.energy = Math.min(100, b.energy + 20);
      a.energy -= 50;
    }
    
    // Herbivore eating plants
    if (a.type === 'herbivore' && b.type === 'plant') {
      a.energy = Math.min(100, a.energy + 10);
      b.energy -= 20;
    } else if (b.type === 'herbivore' && a.type === 'plant') {
      b.energy = Math.min(100, b.energy + 10);
      a.energy -= 20;
    }
  }

  private handleOrganismDeath(id: string) {
    const container = this.organisms.get(id);
    if (container) {
      // Fade out animation
      this.tweens.add({
        targets: container,
        alpha: 0,
        scale: 0.5,
        duration: 500,
        onComplete: () => {
          container.destroy();
          this.organisms.delete(id);
          this.organismData.delete(id);
        }
      });
    }
  }

  public stopSimulation() {
    this.isRunning = false;
    if (this.tickTimer) {
      this.tickTimer.destroy();
      this.tickTimer = null;
    }
    // Start aquarium mode by default when simulation ends
    this.startAquariumMode();
    if (this.callbacks) {
      this.callbacks.onSimulationComplete();
    }
  }

  public startAquariumMode() {
    if (this.aquariumTimer) return; // Already running
    this.isAquariumMode = true;
    this.aquariumTimer = this.time.addEvent({
      delay: 50,
      callback: this.updateAquariumMode,
      callbackScope: this,
      loop: true
    });
  }

  public stopAquariumMode() {
    this.isAquariumMode = false;
    if (this.aquariumTimer) {
      this.aquariumTimer.destroy();
      this.aquariumTimer = null;
    }
  }

  private updateAquariumMode() {
    // Use canvas dimensions for bounds
    const width = this.scale.width;
    const height = this.scale.height;
    const gravity = this.worldConfig?.gravity ?? 1;

    // Just update movement and visuals, no game logic
    this.organismData.forEach((org, id) => {
      const container = this.organisms.get(id);
      if (!container || org.type === 'plant') return;

      // Gentle movement
      const movement = this.calculateMovement(org);
      org.x += movement.x * 0.5; // Slower in aquarium mode
      org.y += movement.y * 0.5;
      org.y += (gravity - 1) * 0.05;

      // Clamp to boundaries
      const padding = org.size / 2;
      org.x = Phaser.Math.Clamp(org.x, padding, width - padding);
      org.y = Phaser.Math.Clamp(org.y, padding, height - padding);

      // Smooth position update
      container.x = Phaser.Math.Linear(container.x, org.x, 0.08);
      container.y = Phaser.Math.Linear(container.y, org.y, 0.08);
      container.setDepth(100 + Math.floor(container.y));
    });
  }

  public pauseSimulation() {
    this.isRunning = false;
  }

  public resumeSimulation() {
    this.isRunning = true;
  }

  public getOrganisms(): Organism[] {
    return Array.from(this.organismData.values());
  }

  public getCurrentTick(): number {
    return this.currentTick;
  }
}
