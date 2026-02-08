import Phaser from "phaser";
import { Organism, WorldConfig, LocomotionType } from "@/types";

// Particle system for visual effects
interface ParticleConfig {
  x: number;
  y: number;
  color: number;
  alpha: number;
  size: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

// Fallback texture config (color-based)
export interface FallbackTextureConfig {
  type: "fallback";
  backgroundColor: string;
  gradientColors: string[];
  patternType:
    | "dots"
    | "waves"
    | "cellular"
    | "organic"
    | "crystalline"
    | "cloudy";
  patternColor: string;
  patternOpacity: number;
  accentColors: string[];
}

// Image-based texture config (from Imagen)
export interface ImageTextureConfig {
  type: "image";
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

  // Enhanced visual systems
  private particles: ParticleConfig[] = [];
  private particleGraphics: Phaser.GameObjects.Graphics | null = null;
  private trailGraphics: Phaser.GameObjects.Graphics | null = null;
  private animationTime: number = 0;
  private nextOrganismId: number = 1000; // For generating new organism IDs

  public get aquariumMode(): boolean {
    return this.isAquariumMode;
  }

  constructor() {
    super({ key: "MainScene" });
  }

  init(data: {
    world: WorldConfig;
    organisms: Organism[];
    texture: TextureConfig;
    maxTicks: number;
    callbacks: SimulationCallbacks;
  }) {
    console.log(
      "MainScene.init:",
      data?.organisms?.length,
      "organisms,",
      data?.texture?.type,
      "texture",
    );

    this.worldConfig = data?.world ?? null;
    this.textureConfig = data?.texture ?? null;
    this.maxTicks = data?.maxTicks ?? 1000;
    this.callbacks = data?.callbacks ?? null;
    this.currentTick = 0;
    this.isRunning = false;

    // Store organism data
    this.organismData.clear();
    if (data?.organisms) {
      data.organisms.forEach((org) => {
        this.organismData.set(org.id, { ...org });
      });
    }
  }

  preload() {
    // Load image texture if available
    if (this.textureConfig?.type === "image" && this.textureConfig.imageData) {
      this.load.image("background-imagen", this.textureConfig.imageData);
    }
  }

  create() {
    // Enable depth sorting for this scene
    this.children.sortChildrenFlag = true;

    this.createBackground();
    this.createParticleSystems();
    this.createOrganisms();
    this.startSimulation();

    // Debug: log what was created
    console.log("MainScene created:", {
      organisms: this.organisms.size,
      background: this.backgroundImage
        ? "image"
        : this.background
          ? "graphics"
          : "none",
      worldSize: this.worldConfig
        ? `${this.worldConfig.width}x${this.worldConfig.height}`
        : "unknown",
    });
  }

  private createParticleSystems() {
    // Create graphics layers for particles and trails
    this.trailGraphics = this.add.graphics();
    this.trailGraphics.setDepth(50); // Below organisms but above background

    this.particleGraphics = this.add.graphics();
    this.particleGraphics.setDepth(200); // Above organisms
  }

  private createBackground() {
    if (!this.textureConfig) return;

    // Use actual game canvas size, not world config
    const width = this.scale.width;
    const height = this.scale.height;

    // Check if we have an image-based texture from Imagen
    if (this.textureConfig.type === "image") {
      this.createImageBackground(width, height);
    } else {
      // Use fallback color-based texture
      this.createFallbackBackground(width, height, this.textureConfig);
    }
  }

  private createImageBackground(width: number, height: number) {
    // Check if the texture was loaded successfully
    if (this.textures.exists("background-imagen")) {
      this.backgroundImage = this.add.image(
        width / 2,
        height / 2,
        "background-imagen",
      );

      // Scale image to fit the world dimensions
      const scaleX = width / this.backgroundImage.width;
      const scaleY = height / this.backgroundImage.height;
      const scale = Math.max(scaleX, scaleY); // Cover the entire area
      this.backgroundImage.setScale(scale);

      // Send to back - use very low depth to ensure it's behind everything
      this.backgroundImage.setDepth(-1000);
      console.log(
        "Background image created with depth:",
        this.backgroundImage.depth,
      );
    } else {
      // Fallback to a solid color if image didn't load
      console.log("Background image texture not found, using fallback");
      this.background = this.add.graphics();
      this.background.fillStyle(0x1a3a4a, 1);
      this.background.fillRect(0, 0, width, height);
      this.background.setDepth(-1000);
    }
  }

  private createFallbackBackground(
    width: number,
    height: number,
    config: FallbackTextureConfig,
  ) {
    this.background = this.add.graphics();
    this.background.setDepth(-1000);

    // Draw gradient background
    const bgColor = Phaser.Display.Color.HexStringToColor(
      config.backgroundColor,
    );
    this.background.fillStyle(bgColor.color, 1);
    this.background.fillRect(0, 0, width, height);

    // Add gradient overlay
    if (config.gradientColors.length > 1) {
      const gradientColors = config.gradientColors.map(
        (c) => Phaser.Display.Color.HexStringToColor(c).color,
      );

      for (let i = 0; i < height; i++) {
        const ratio = i / height;
        const colorIndex = Math.floor(ratio * (gradientColors.length - 1));
        const nextIndex = Math.min(colorIndex + 1, gradientColors.length - 1);
        const localRatio = ratio * (gradientColors.length - 1) - colorIndex;

        const color = Phaser.Display.Color.Interpolate.ColorWithColor(
          Phaser.Display.Color.IntegerToColor(gradientColors[colorIndex]),
          Phaser.Display.Color.IntegerToColor(gradientColors[nextIndex]),
          100,
          localRatio * 100,
        );

        this.background.lineStyle(
          1,
          Phaser.Display.Color.GetColor(color.r, color.g, color.b),
          0.3,
        );
        this.background.lineBetween(0, i, width, i);
      }
    }

    // Add pattern based on type
    this.addPattern(config);
  }

  private addPattern(config?: FallbackTextureConfig) {
    const textureConfig =
      config ||
      (this.textureConfig?.type === "fallback" ? this.textureConfig : null);
    if (!textureConfig || !this.worldConfig || !this.background) return;

    const { width, height } = this.worldConfig;
    const patternColor = Phaser.Display.Color.HexStringToColor(
      textureConfig.patternColor,
    ).color;

    switch (textureConfig.patternType) {
      case "dots":
        this.addDotsPattern(width, height, patternColor);
        break;
      case "waves":
        this.addWavesPattern(width, height, patternColor);
        break;
      case "cellular":
        this.addCellularPattern(width, height, patternColor);
        break;
      case "organic":
        this.addOrganicPattern(width, height, patternColor);
        break;
      case "crystalline":
        this.addCrystallinePattern(width, height, patternColor);
        break;
      case "cloudy":
        this.addCloudyPattern(width, height, patternColor);
        break;
    }
  }

  private getPatternOpacity(): number {
    if (this.textureConfig?.type === "fallback") {
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
        this.background.fillCircle(
          x + offset,
          y + offset,
          2 + Math.random() * 3,
        );
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
    points.forEach((point) => {
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
      this.background.fillEllipse(
        x,
        y,
        size,
        size * (0.5 + Math.random() * 0.5),
      );
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
        points.push(
          new Phaser.Geom.Point(
            x + Math.cos(angle) * radius,
            y + Math.sin(angle) * radius,
          ),
        );
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
        this.background.fillCircle(
          x + offsetX,
          y + offsetY,
          10 + Math.random() * 20,
        );
      }
    }
  }

  private createOrganisms() {
    this.organisms.forEach((container) => container.destroy());
    this.organisms.clear();

    const canvasWidth = this.scale.width;
    const canvasHeight = this.scale.height;
    const worldWidth = this.worldConfig?.width ?? canvasWidth;
    const worldHeight = this.worldConfig?.height ?? canvasHeight;

    // Scale factor to map world coords to canvas coords
    const scaleX = canvasWidth / worldWidth;
    const scaleY = canvasHeight / worldHeight;

    console.log(
      "Creating",
      this.organismData.size,
      "organisms. Canvas:",
      canvasWidth,
      "x",
      canvasHeight,
      "Scale:",
      scaleX.toFixed(2),
      scaleY.toFixed(2),
    );

    this.organismData.forEach((org, id) => {
      // Scale organism positions to fit canvas
      org.x = org.x * scaleX;
      org.y = org.y * scaleY;

      // Set default locomotion if not provided (backward compatibility)
      if (!org.locomotion) {
        org.locomotion = this.inferLocomotion(org);
      }

      // Ensure within bounds
      const padding = org.size / 2;
      org.x = Phaser.Math.Clamp(org.x, padding, canvasWidth - padding);
      org.y = Phaser.Math.Clamp(org.y, padding, canvasHeight - padding);

      const container = this.createOrganismSprite(org);
      this.organisms.set(id, container);
    });

    console.log("Organisms created. Count:", this.organisms.size);
  }

  private createOrganismSprite(org: Organism): Phaser.GameObjects.Container {
    const container = this.add.container(org.x, org.y);

    // Set depth - organisms should always be above background (which is at -1000)
    container.setDepth(100 + Math.floor(org.y));

    // Create a graphics object
    const graphics = this.add.graphics();
    const color = Phaser.Display.Color.HexStringToColor(org.color).color;
    const secondaryColor = org.secondaryColor
      ? Phaser.Display.Color.HexStringToColor(org.secondaryColor).color
      : Phaser.Display.Color.IntegerToColor(color).darken(30).color;

    // Draw locomotion-specific appendages first (behind the body)
    this.drawLocomotionFeatures(graphics, org, color, secondaryColor);

    // Draw the organism body based on type
    switch (org.type) {
      case "plant":
        this.drawPlant(graphics, org.size, color, secondaryColor);
        break;
      case "herbivore":
        this.drawHerbivore(
          graphics,
          org.size,
          color,
          secondaryColor,
          org.locomotion,
        );
        break;
      case "carnivore":
        this.drawCarnivore(
          graphics,
          org.size,
          color,
          secondaryColor,
          org.locomotion,
        );
        break;
      case "omnivore":
        this.drawOmnivore(
          graphics,
          org.size,
          color,
          secondaryColor,
          org.locomotion,
        );
        break;
      case "decomposer":
        this.drawDecomposer(graphics, org.size, color);
        break;
      case "microbe":
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
    container.setData("energyBar", energyBar);
    container.setData("organism", org);

    // Add name label (hidden by default, shown on hover)
    const nameLabel = this.add.text(0, -org.size / 2 - 20, org.name, {
      fontSize: "12px",
      fontFamily: "Arial, sans-serif",
      color: "#ffffff",
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      padding: { x: 6, y: 3 },
      align: "center",
    });
    nameLabel.setOrigin(0.5, 1);
    nameLabel.setVisible(false);
    container.add(nameLabel);
    container.setData("nameLabel", nameLabel);

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
      hitArea: new Phaser.Geom.Rectangle(
        -hitSize,
        -hitSize,
        hitSize * 2,
        hitSize * 2,
      ),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });

    container.on("pointerdown", () => {
      console.log("Organism clicked:", org.name);
      if (this.callbacks?.onOrganismClick) {
        const currentOrg = this.organismData.get(org.id);
        if (currentOrg) {
          this.callbacks.onOrganismClick(currentOrg);
        }
      }
    });

    container.on("pointerover", () => {
      container.setScale(1.15);
      nameLabel.setVisible(true);
    });

    container.on("pointerout", () => {
      container.setScale(1.0);
      nameLabel.setVisible(false);
    });

    return container;
  }

  private drawLocomotionFeatures(
    graphics: Phaser.GameObjects.Graphics,
    org: Organism,
    color: number,
    secondaryColor: number,
  ) {
    const size = org.size;
    const locomotion = org.locomotion || "walking";

    switch (locomotion) {
      case "flying":
      case "gliding":
        // Wings
        graphics.fillStyle(secondaryColor, 0.7);
        // Left wing
        graphics.beginPath();
        graphics.moveTo(-size / 6, 0);
        graphics.lineTo(-size, -size / 3);
        graphics.lineTo(-size * 0.8, size / 4);
        graphics.closePath();
        graphics.fillPath();
        // Right wing
        graphics.beginPath();
        graphics.moveTo(-size / 6, 0);
        graphics.lineTo(-size, size / 3);
        graphics.lineTo(-size * 0.8, -size / 4);
        graphics.closePath();
        graphics.fillPath();
        break;

      case "swimming":
        // Fins
        graphics.fillStyle(secondaryColor, 0.8);
        // Dorsal fin
        graphics.fillTriangle(
          0,
          -size / 3,
          -size / 4,
          -size / 2,
          size / 4,
          -size / 2,
        );
        // Tail fin
        graphics.fillTriangle(
          -size / 2,
          0,
          -size * 0.8,
          -size / 3,
          -size * 0.8,
          size / 3,
        );
        // Pectoral fins
        graphics.fillTriangle(
          size / 6,
          size / 4,
          0,
          size / 2,
          size / 3,
          size / 3,
        );
        graphics.fillTriangle(
          size / 6,
          -size / 4,
          0,
          -size / 2,
          size / 3,
          -size / 3,
        );
        break;

      case "hopping":
        // Strong back legs
        graphics.fillStyle(secondaryColor, 0.9);
        graphics.fillEllipse(-size / 3, size / 3, size / 3, size / 5);
        graphics.fillEllipse(-size / 3, -size / 3, size / 3, size / 5);
        break;

      case "slithering":
        // Curved body segments behind
        graphics.fillStyle(color, 0.6);
        for (let i = 1; i <= 3; i++) {
          const segX = -size / 2 - (i * size) / 4;
          const segY = (Math.sin(i * 0.8) * size) / 6;
          graphics.fillCircle(segX, segY, (size / 3) * (1 - i * 0.15));
        }
        break;

      case "crawling":
        // Multiple legs
        graphics.lineStyle(2, secondaryColor, 0.8);
        for (let i = 0; i < 4; i++) {
          const legX = -size / 4 + (i * size) / 6;
          // Top legs
          graphics.beginPath();
          graphics.moveTo(legX, -size / 4);
          graphics.lineTo(legX - size / 6, -size / 2);
          graphics.strokePath();
          // Bottom legs
          graphics.beginPath();
          graphics.moveTo(legX, size / 4);
          graphics.lineTo(legX - size / 6, size / 2);
          graphics.strokePath();
        }
        break;

      case "burrowing":
        // Claws/digging appendages
        graphics.fillStyle(secondaryColor, 0.9);
        graphics.fillTriangle(
          size / 2,
          0,
          size * 0.7,
          -size / 4,
          size * 0.8,
          0,
        );
        graphics.fillTriangle(size / 2, 0, size * 0.7, size / 4, size * 0.8, 0);
        break;

      case "floating":
        // Tentacles/frills
        graphics.lineStyle(2, secondaryColor, 0.6);
        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI + Math.PI / 2;
          graphics.beginPath();
          graphics.moveTo(0, size / 4);
          const tentX = Math.cos(angle) * size * 0.6;
          const tentY = size / 4 + Math.abs(Math.sin(angle)) * size * 0.5;
          graphics.lineTo(tentX, tentY);
          graphics.strokePath();
        }
        break;
    }
  }

  private drawPlant(
    graphics: Phaser.GameObjects.Graphics,
    size: number,
    color: number,
    secondaryColor?: number,
  ) {
    const secondary =
      secondaryColor ||
      Phaser.Display.Color.IntegerToColor(color).darken(20).color;

    // Stem
    graphics.fillStyle(secondary, 1);
    graphics.fillRect(-size / 8, 0, size / 4, size / 2);

    // Main body (flower/leaves)
    graphics.fillStyle(color, 1);
    graphics.fillCircle(0, 0, size / 3);

    // Petals/leaves
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const x = (Math.cos(angle) * size) / 2.5;
      const y = (Math.sin(angle) * size) / 2.5;
      graphics.fillStyle(i % 2 === 0 ? color : secondary, 1);
      graphics.fillEllipse(x, y, size / 4, size / 5);
    }

    // Center
    graphics.fillStyle(0xffff00, 0.8);
    graphics.fillCircle(0, 0, size / 6);
  }

  private drawHerbivore(
    graphics: Phaser.GameObjects.Graphics,
    size: number,
    color: number,
    secondaryColor?: number,
    locomotion?: string,
  ) {
    const secondary = secondaryColor || 0xffffff;

    // Body shape varies by locomotion
    graphics.fillStyle(color, 1);
    if (locomotion === "swimming") {
      // Fish-like body
      graphics.fillEllipse(0, 0, size, size * 0.5);
      // Scales pattern
      graphics.fillStyle(secondary, 0.3);
      for (let i = 0; i < 3; i++) {
        graphics.fillCircle(-size / 4 + (i * size) / 4, 0, size / 8);
      }
    } else if (locomotion === "hopping") {
      // Rounded body with emphasis on back
      graphics.fillEllipse(-size / 8, 0, size * 0.8, size * 0.6);
    } else {
      // Default oval body
      graphics.fillEllipse(0, 0, size, size * 0.7);
    }

    // Spots/pattern
    graphics.fillStyle(secondary, 0.4);
    graphics.fillCircle(0, 0, size / 6);
    graphics.fillCircle(-size / 4, -size / 8, size / 10);

    // Eyes
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(size / 3, -size / 8, size / 7);
    graphics.fillStyle(0x000000, 1);
    graphics.fillCircle(size / 3 + size / 14, -size / 8, size / 14);
  }

  private drawCarnivore(
    graphics: Phaser.GameObjects.Graphics,
    size: number,
    color: number,
    secondaryColor?: number,
    locomotion?: string,
  ) {
    const secondary = secondaryColor || 0x000000;

    graphics.fillStyle(color, 1);

    if (locomotion === "swimming") {
      // Shark-like
      graphics.fillEllipse(0, 0, size * 1.1, size * 0.45);
      // Stripes
      graphics.fillStyle(secondary, 0.3);
      graphics.fillRect(-size / 4, -size / 4, size / 10, size / 2);
      graphics.fillRect(0, -size / 4, size / 10, size / 2);
    } else if (locomotion === "flying") {
      // Hawk-like body
      graphics.fillEllipse(0, 0, size * 0.9, size * 0.5);
      // Beak
      graphics.fillStyle(0xffa500, 1);
      graphics.fillTriangle(
        size / 2,
        0,
        size * 0.7,
        -size / 10,
        size * 0.7,
        size / 10,
      );
    } else {
      // Predator body - sleek and angular
      graphics.beginPath();
      graphics.moveTo(-size / 2, 0);
      graphics.lineTo(-size / 4, -size / 3);
      graphics.lineTo(size / 2, 0);
      graphics.lineTo(-size / 4, size / 3);
      graphics.closePath();
      graphics.fillPath();
    }

    // Menacing eyes
    graphics.fillStyle(0xffff00, 1);
    graphics.fillCircle(size / 4, -size / 10, size / 8);
    graphics.fillStyle(0x000000, 1);
    graphics.fillCircle(size / 4 + size / 16, -size / 10, size / 16);

    // Teeth/claws indicator
    graphics.fillStyle(0xffffff, 1);
    graphics.fillTriangle(
      size / 2,
      0,
      size / 2 + size / 8,
      -size / 12,
      size / 2 + size / 8,
      size / 12,
    );
  }

  private drawOmnivore(
    graphics: Phaser.GameObjects.Graphics,
    size: number,
    color: number,
    secondaryColor?: number,
    locomotion?: string,
  ) {
    const secondary = secondaryColor || 0xffffff;

    graphics.fillStyle(color, 1);

    if (locomotion === "swimming") {
      graphics.fillEllipse(0, 0, size * 0.9, size * 0.6);
    } else if (locomotion === "flying") {
      graphics.fillEllipse(0, 0, size * 0.7, size * 0.5);
    } else {
      graphics.fillRoundedRect(
        -size / 2,
        -size * 0.35,
        size,
        size * 0.7,
        size / 5,
      );
    }

    // Pattern
    graphics.fillStyle(secondary, 0.5);
    graphics.fillCircle(-size / 6, 0, size / 5);

    // Eyes
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(size / 5, -size / 8, size / 8);
    graphics.fillCircle(size / 5, size / 8, size / 8);
    graphics.fillStyle(0x000000, 1);
    graphics.fillCircle(size / 5 + size / 16, -size / 8, size / 16);
    graphics.fillCircle(size / 5 + size / 16, size / 8, size / 16);
  }

  private drawDecomposer(
    graphics: Phaser.GameObjects.Graphics,
    size: number,
    color: number,
  ) {
    graphics.fillStyle(color, 0.8);
    // Blob shape
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const x = (Math.cos(angle) * size) / 3;
      const y = (Math.sin(angle) * size) / 3;
      graphics.fillCircle(x, y, size / 4);
    }
  }

  private drawMicrobe(
    graphics: Phaser.GameObjects.Graphics,
    size: number,
    color: number,
  ) {
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

  private updateEnergyBar(
    graphics: Phaser.GameObjects.Graphics,
    org: Organism,
  ) {
    graphics.clear();
    const barWidth = org.size;
    const barHeight = 3;
    const yOffset = -org.size / 2 - 8;

    // Background
    graphics.fillStyle(0x333333, 0.8);
    graphics.fillRect(-barWidth / 2, yOffset, barWidth, barHeight);

    // Energy fill
    const energyPercent = org.energy / 100;
    const fillColor =
      energyPercent > 0.5
        ? 0x00ff00
        : energyPercent > 0.25
          ? 0xffff00
          : 0xff0000;
    graphics.fillStyle(fillColor, 1);
    graphics.fillRect(
      -barWidth / 2,
      yOffset,
      barWidth * energyPercent,
      barHeight,
    );
  }

  private startSimulation() {
    this.isRunning = true;
    this.tickTimer = this.time.addEvent({
      delay: 50, // 20 ticks per second
      callback: this.onTick,
      callbackScope: this,
      loop: true,
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

    // Update animation time
    this.animationTime += 0.05;

    // Clear trail graphics with fade effect
    if (this.trailGraphics) {
      this.trailGraphics.clear();
    }

    this.organismData.forEach((org, id) => {
      const container = this.organisms.get(id);
      if (!container) return;

      // Initialize runtime state if needed
      if (org.direction === undefined)
        org.direction = Math.random() * Math.PI * 2;
      if (org.animationPhase === undefined)
        org.animationPhase = Math.random() * Math.PI * 2;

      // Update animation phase
      org.animationPhase += 0.1;

      // Move based on type, behavior, and locomotion
      if (org.type !== "plant" && org.locomotion !== "sessile") {
        const movement = this.calculateEnhancedMovement(org);

        // Apply locomotion-specific modifiers
        const locomotionMod = this.getLocomotionModifiers(org.locomotion);

        org.x += movement.x * locomotionMod.speedMult;
        org.y += movement.y * locomotionMod.speedMult;

        // Update direction based on movement
        if (Math.abs(movement.x) > 0.01 || Math.abs(movement.y) > 0.01) {
          const targetDir = Math.atan2(movement.y, movement.x);
          // Smooth rotation
          org.direction = Phaser.Math.Angle.RotateTo(
            org.direction,
            targetDir,
            0.1,
          );
        }

        // Apply gravity influence (modified by locomotion)
        org.y += (gravity - 1) * locomotionMod.gravityMult * 0.1;

        // Apply locomotion-specific vertical movement
        if (org.locomotion === "flying" || org.locomotion === "gliding") {
          org.y += Math.sin(this.animationTime * 2 + org.animationPhase) * 0.5;
        } else if (org.locomotion === "hopping") {
          const hopPhase =
            (this.animationTime * 3 + org.animationPhase) % (Math.PI * 2);
          if (hopPhase < Math.PI) {
            org.y -= Math.sin(hopPhase) * 2;
          }
        } else if (
          org.locomotion === "swimming" ||
          org.locomotion === "floating"
        ) {
          org.y += Math.sin(this.animationTime + org.animationPhase) * 0.3;
          org.x +=
            Math.sin(this.animationTime * 0.5 + org.animationPhase) * 0.2;
        }

        // Clamp to boundaries with padding for organism size
        const padding = org.size / 2;
        org.x = Phaser.Math.Clamp(org.x, padding, width - padding);
        org.y = Phaser.Math.Clamp(org.y, padding, height - padding);

        // Update container position with smooth lerp
        container.x = Phaser.Math.Linear(container.x, org.x, 0.15);
        container.y = Phaser.Math.Linear(container.y, org.y, 0.15);

        // Apply rotation based on direction (for non-radial organisms)
        if (org.type !== "decomposer" && org.type !== "microbe") {
          container.rotation = Phaser.Math.Linear(
            container.rotation,
            org.direction,
            0.1,
          );
        }

        // Apply idle animation (subtle scale pulsing)
        const pulseScale = 1 + Math.sin(org.animationPhase) * 0.05;
        container.setScale(pulseScale);

        // Update depth based on y position for proper layering (base of 100 to stay above background)
        container.setDepth(100 + Math.floor(container.y));

        // Spawn locomotion particles
        this.spawnLocomotionParticles(org);
      } else {
        // Plants have gentle swaying animation
        const sway = Math.sin(this.animationTime + org.animationPhase) * 0.05;
        container.rotation = sway;
        const pulseScale = 1 + Math.sin(org.animationPhase * 0.5) * 0.03;
        container.setScale(pulseScale);
      }

      // Update energy
      org.energy -= 0.03;
      if (org.type === "plant") {
        // Plants gain energy from "photosynthesis"
        org.energy += 0.08;
      }
      org.energy = Phaser.Math.Clamp(org.energy, 0, 100);

      // Update age
      org.age += 1;

      // Update energy bar
      const energyBar = container.getData(
        "energyBar",
      ) as Phaser.GameObjects.Graphics;
      if (energyBar) {
        this.updateEnergyBar(energyBar, org);
      }

      // Handle reproduction
      if (org.energy > 80 && Math.random() < org.reproductionRate * 0.1) {
        this.handleReproduction(org);
      }

      // Check for death
      if (org.energy <= 0 || org.age >= org.maxAge) {
        this.handleOrganismDeath(id);
      }
    });

    // Update particles
    this.updateParticles();

    // Check for interactions
    this.checkInteractions();
  }

  private getLocomotionModifiers(locomotion: LocomotionType): {
    speedMult: number;
    gravityMult: number;
  } {
    switch (locomotion) {
      case "flying":
        return { speedMult: 1.5, gravityMult: 0.1 };
      case "gliding":
        return { speedMult: 1.2, gravityMult: 0.3 };
      case "swimming":
        return { speedMult: 1.0, gravityMult: 0.2 };
      case "floating":
        return { speedMult: 0.5, gravityMult: 0.0 };
      case "hopping":
        return { speedMult: 1.3, gravityMult: 0.8 };
      case "slithering":
        return { speedMult: 0.8, gravityMult: 1.0 };
      case "burrowing":
        return { speedMult: 0.6, gravityMult: 1.2 };
      case "crawling":
        return { speedMult: 0.7, gravityMult: 1.0 };
      case "walking":
      default:
        return { speedMult: 1.0, gravityMult: 1.0 };
    }
  }

  private spawnLocomotionParticles(org: Organism) {
    const color = Phaser.Display.Color.HexStringToColor(org.color).color;

    // Only spawn particles occasionally for performance
    if (Math.random() > 0.3) return;

    switch (org.locomotion) {
      case "swimming":
      case "floating":
        // Bubble particles
        this.particles.push({
          x: org.x - (Math.cos(org.direction || 0) * org.size) / 2,
          y: org.y - (Math.sin(org.direction || 0) * org.size) / 2,
          color: 0xadd8e6,
          alpha: 0.6,
          size: 2 + Math.random() * 3,
          vx: (Math.random() - 0.5) * 0.5,
          vy: -0.5 - Math.random() * 0.5,
          life: 30,
          maxLife: 30,
        });
        break;

      case "flying":
      case "gliding":
        // Air trail particles
        if (Math.random() > 0.5) {
          this.particles.push({
            x: org.x - (Math.cos(org.direction || 0) * org.size) / 2,
            y: org.y,
            color: 0xffffff,
            alpha: 0.3,
            size: 1 + Math.random() * 2,
            vx: -Math.cos(org.direction || 0) * 0.5,
            vy: Math.random() * 0.3,
            life: 20,
            maxLife: 20,
          });
        }
        break;

      case "hopping":
        // Dust particles on landing
        const hopPhase =
          (this.animationTime * 3 + (org.animationPhase || 0)) % (Math.PI * 2);
        if (hopPhase > Math.PI - 0.2 && hopPhase < Math.PI + 0.2) {
          for (let i = 0; i < 3; i++) {
            this.particles.push({
              x: org.x + (Math.random() - 0.5) * org.size,
              y: org.y + org.size / 2,
              color: 0x8b7355,
              alpha: 0.5,
              size: 2 + Math.random() * 2,
              vx: (Math.random() - 0.5) * 2,
              vy: -Math.random() * 1,
              life: 15,
              maxLife: 15,
            });
          }
        }
        break;

      case "slithering":
        // Trail particles
        this.particles.push({
          x: org.x - (Math.cos(org.direction || 0) * org.size) / 2,
          y: org.y - (Math.sin(org.direction || 0) * org.size) / 2,
          color: color,
          alpha: 0.2,
          size: org.size / 4,
          vx: 0,
          vy: 0,
          life: 40,
          maxLife: 40,
        });
        break;
    }
  }

  private updateParticles() {
    if (!this.particleGraphics) return;

    this.particleGraphics.clear();

    // Spawn ambient biome particles occasionally
    this.spawnAmbientParticles();

    // Update and draw particles
    this.particles = this.particles.filter((p) => {
      p.life--;
      if (p.life <= 0) return false;

      p.x += p.vx;
      p.y += p.vy;
      p.alpha = (p.life / p.maxLife) * p.alpha;

      this.particleGraphics!.fillStyle(p.color, p.alpha);
      this.particleGraphics!.fillCircle(p.x, p.y, p.size);

      return true;
    });

    // Limit max particles for performance
    if (this.particles.length > 300) {
      this.particles = this.particles.slice(-300);
    }
  }

  private spawnAmbientParticles() {
    const width = this.scale.width;
    const height = this.scale.height;
    const biome = this.worldConfig?.biome || "forest";

    // Only spawn occasionally
    if (Math.random() > 0.15) return;

    switch (biome) {
      case "ocean":
      case "swamp":
        // Rising bubbles
        this.particles.push({
          x: Math.random() * width,
          y: height + 10,
          color: 0xadd8e6,
          alpha: 0.4,
          size: 2 + Math.random() * 4,
          vx: (Math.random() - 0.5) * 0.5,
          vy: -1 - Math.random() * 1.5,
          life: 80,
          maxLife: 80,
        });
        break;

      case "forest":
      case "grassland":
        // Floating pollen/leaves
        if (Math.random() > 0.5) {
          this.particles.push({
            x: Math.random() * width,
            y: -10,
            color: Math.random() > 0.7 ? 0x90ee90 : 0xffff99,
            alpha: 0.5,
            size: 2 + Math.random() * 3,
            vx: (Math.random() - 0.5) * 1,
            vy: 0.5 + Math.random() * 0.5,
            life: 100,
            maxLife: 100,
          });
        }
        break;

      case "desert":
        // Dust particles
        this.particles.push({
          x: -10,
          y: Math.random() * height,
          color: 0xd2b48c,
          alpha: 0.3,
          size: 1 + Math.random() * 2,
          vx: 1 + Math.random() * 2,
          vy: (Math.random() - 0.5) * 0.5,
          life: 60,
          maxLife: 60,
        });
        break;

      case "tundra":
        // Snowflakes
        this.particles.push({
          x: Math.random() * width,
          y: -10,
          color: 0xffffff,
          alpha: 0.7,
          size: 2 + Math.random() * 2,
          vx: (Math.random() - 0.5) * 0.8,
          vy: 0.8 + Math.random() * 0.5,
          life: 120,
          maxLife: 120,
        });
        break;

      case "volcanic":
        // Ash and embers
        if (Math.random() > 0.7) {
          this.particles.push({
            x: Math.random() * width,
            y: height + 10,
            color: Math.random() > 0.5 ? 0xff4500 : 0x333333,
            alpha: 0.6,
            size: 1 + Math.random() * 3,
            vx: (Math.random() - 0.5) * 1,
            vy: -1.5 - Math.random() * 1,
            life: 50,
            maxLife: 50,
          });
        }
        break;

      case "cave":
        // Dripping water / glowing spores
        if (Math.random() > 0.8) {
          this.particles.push({
            x: Math.random() * width,
            y: 0,
            color: Math.random() > 0.5 ? 0x00ffff : 0x4169e1,
            alpha: 0.5,
            size: 2 + Math.random() * 2,
            vx: 0,
            vy: 1 + Math.random() * 0.5,
            life: 70,
            maxLife: 70,
          });
        }
        break;

      case "alien":
        // Strange glowing particles
        this.particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          color: [0xff00ff, 0x00ffff, 0x00ff00, 0xff6600][
            Math.floor(Math.random() * 4)
          ],
          alpha: 0.5,
          size: 1 + Math.random() * 3,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          life: 40,
          maxLife: 40,
        });
        break;
    }
  }

  private handleReproduction(parent: Organism) {
    // Limit total organisms for performance
    if (this.organismData.size >= 50) return;

    // Reduce parent energy
    parent.energy -= 30;

    // Create offspring
    const offspring: Organism = {
      ...parent,
      id: `org-${this.nextOrganismId++}`,
      x: parent.x + (Math.random() - 0.5) * parent.size * 3,
      y: parent.y + (Math.random() - 0.5) * parent.size * 3,
      energy: 50,
      age: 0,
      direction: Math.random() * Math.PI * 2,
      animationPhase: Math.random() * Math.PI * 2,
      // Slight mutation in size and speed
      size: parent.size * (0.9 + Math.random() * 0.2),
      speed: parent.speed * (0.9 + Math.random() * 0.2),
      generation: (parent.generation || 1) + 1,
    };

    // Add to simulation
    this.organismData.set(offspring.id, offspring);
    const container = this.createOrganismSprite(offspring);
    this.organisms.set(offspring.id, container);

    // Birth particle effect
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      this.particles.push({
        x: offspring.x,
        y: offspring.y,
        color: Phaser.Display.Color.HexStringToColor(offspring.color).color,
        alpha: 0.8,
        size: 3,
        vx: Math.cos(angle) * 2,
        vy: Math.sin(angle) * 2,
        life: 20,
        maxLife: 20,
      });
    }
  }

  private calculateEnhancedMovement(org: Organism): { x: number; y: number } {
    const speed = org.speed;
    let dx = 0;
    let dy = 0;

    switch (org.behavior) {
      case "passive":
        // Random wandering with momentum
        dx = (Math.random() - 0.5) * speed;
        dy = (Math.random() - 0.5) * speed;
        break;

      case "aggressive":
        // Move toward nearest prey with higher speed
        const prey = this.findNearestPrey(org);
        if (prey) {
          const angle = Math.atan2(prey.y - org.y, prey.x - org.x);
          dx = Math.cos(angle) * speed * 1.5;
          dy = Math.sin(angle) * speed * 1.5;
        } else {
          dx = (Math.random() - 0.5) * speed;
          dy = (Math.random() - 0.5) * speed;
        }
        break;

      case "ambush":
        // Stay still, then burst toward prey when close
        const nearbyPrey = this.findNearestPrey(org);
        if (nearbyPrey && this.getDistance(org, nearbyPrey) < 80) {
          const angle = Math.atan2(nearbyPrey.y - org.y, nearbyPrey.x - org.x);
          dx = Math.cos(angle) * speed * 2.5;
          dy = Math.sin(angle) * speed * 2.5;
        }
        break;

      case "territorial":
        // Stay in area but patrol
        const patrolAngle =
          Math.sin(this.currentTick * 0.02 + parseInt(org.id, 36)) * Math.PI;
        dx = Math.cos(patrolAngle) * speed * 0.5;
        dy = Math.sin(patrolAngle) * speed * 0.5;
        break;

      case "social":
      case "schooling":
        // Move toward center of nearby allies, align direction
        const allies = this.findNearbyAllies(org, 100);
        if (allies.length > 0) {
          let avgX = 0,
            avgY = 0,
            avgDx = 0,
            avgDy = 0;
          allies.forEach((ally) => {
            avgX += ally.x;
            avgY += ally.y;
            avgDx += Math.cos(ally.direction || 0);
            avgDy += Math.sin(ally.direction || 0);
          });
          avgX /= allies.length;
          avgY /= allies.length;

          // Cohesion - move toward center
          const toCenter = Math.atan2(avgY - org.y, avgX - org.x);
          dx = Math.cos(toCenter) * speed * 0.3;
          dy = Math.sin(toCenter) * speed * 0.3;

          // Alignment - match average direction
          dx += (avgDx / allies.length) * speed * 0.5;
          dy += (avgDy / allies.length) * speed * 0.5;

          // Separation - avoid getting too close
          allies.forEach((ally) => {
            const dist = this.getDistance(org, ally);
            if (dist < org.size * 2) {
              const away = Math.atan2(org.y - ally.y, org.x - ally.x);
              dx += Math.cos(away) * speed * 0.5;
              dy += Math.sin(away) * speed * 0.5;
            }
          });
        } else {
          dx = (Math.random() - 0.5) * speed;
          dy = (Math.random() - 0.5) * speed;
        }
        break;

      case "grazing":
        // Slow, steady movement with occasional direction changes
        if (Math.random() < 0.02) {
          org.targetX = org.x + (Math.random() - 0.5) * 200;
          org.targetY = org.y + (Math.random() - 0.5) * 200;
        }
        if (org.targetX !== undefined && org.targetY !== undefined) {
          const toTarget = Math.atan2(org.targetY - org.y, org.targetX - org.x);
          dx = Math.cos(toTarget) * speed * 0.5;
          dy = Math.sin(toTarget) * speed * 0.5;
        }
        break;

      case "solitary":
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

      case "migratory":
        // Move in consistent direction with gradual turning
        const migrationAngle =
          this.currentTick * 0.005 + (parseInt(org.id, 36) % 10);
        dx = Math.cos(migrationAngle) * speed;
        dy = Math.sin(migrationAngle) * speed * 0.5;
        break;
    }

    return { x: dx, y: dy };
  }

  private findNearbyAllies(org: Organism, radius: number): Organism[] {
    const allies: Organism[] = [];
    this.organismData.forEach((other) => {
      if (other.id === org.id) return;
      if (
        other.species === org.species &&
        this.getDistance(org, other) < radius
      ) {
        allies.push(other);
      }
    });
    return allies;
  }

  private findNearestPrey(predator: Organism): Organism | null {
    let nearest: Organism | null = null;
    let minDist = Infinity;

    this.organismData.forEach((org) => {
      if (org.id === predator.id) return;
      if (
        predator.type === "carnivore" &&
        (org.type === "herbivore" || org.type === "omnivore")
      ) {
        const dist = this.getDistance(predator, org);
        if (dist < minDist) {
          minDist = dist;
          nearest = org;
        }
      }
    });

    return nearest;
  }

  // @ts-ignore: kept for future use
  private findNearestAlly(org: Organism): Organism | null {
    let nearest: Organism | null = null;
    let minDist = Infinity;

    this.organismData.forEach((other) => {
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

    this.organismData.forEach((other) => {
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

  private inferLocomotion(org: Organism): LocomotionType {
    // Infer locomotion based on organism type and biome
    const biome = this.worldConfig?.biome || "forest";

    if (org.type === "plant") return "sessile";
    if (org.type === "microbe") return "floating";

    // Biome-specific defaults
    if (biome === "ocean" || biome === "swamp") {
      if (org.type === "carnivore") return "swimming";
      if (org.type === "herbivore")
        return Math.random() > 0.5 ? "swimming" : "floating";
      return "swimming";
    }

    if (biome === "cave") {
      return Math.random() > 0.5 ? "crawling" : "flying";
    }

    // Default based on behavior and type
    if (org.behavior === "migratory")
      return Math.random() > 0.5 ? "flying" : "walking";
    if (org.type === "carnivore")
      return Math.random() > 0.3 ? "walking" : "flying";
    if (org.type === "decomposer") return "crawling";

    // Random variety for others
    const locomotions: LocomotionType[] = [
      "walking",
      "hopping",
      "crawling",
      "slithering",
    ];
    return locomotions[Math.floor(Math.random() * locomotions.length)];
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
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;

    // Predation - carnivore attacks
    if (
      a.type === "carnivore" &&
      (b.type === "herbivore" || b.type === "plant")
    ) {
      a.energy = Math.min(100, a.energy + 25);
      b.energy -= 60;
      // Attack particles
      this.spawnInteractionParticles(midX, midY, 0xff4444, 0xffff00, "attack");
    } else if (
      b.type === "carnivore" &&
      (a.type === "herbivore" || a.type === "plant")
    ) {
      b.energy = Math.min(100, b.energy + 25);
      a.energy -= 60;
      this.spawnInteractionParticles(midX, midY, 0xff4444, 0xffff00, "attack");
    }

    // Herbivore eating plants
    else if (a.type === "herbivore" && b.type === "plant") {
      a.energy = Math.min(100, a.energy + 15);
      b.energy -= 25;
      // Eating particles
      this.spawnInteractionParticles(midX, midY, 0x90ee90, 0xffffff, "eat");
    } else if (b.type === "herbivore" && a.type === "plant") {
      b.energy = Math.min(100, b.energy + 15);
      a.energy -= 25;
      this.spawnInteractionParticles(midX, midY, 0x90ee90, 0xffffff, "eat");
    }

    // Social species grouping - energy boost when near allies
    else if (
      a.species === b.species &&
      (a.behavior === "social" || a.behavior === "schooling")
    ) {
      a.energy = Math.min(100, a.energy + 0.5);
      b.energy = Math.min(100, b.energy + 0.5);
    }
  }

  private spawnInteractionParticles(
    x: number,
    y: number,
    color1: number,
    color2: number,
    type: "attack" | "eat",
  ) {
    const count = type === "attack" ? 8 : 5;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed =
        type === "attack" ? 2 + Math.random() * 2 : 1 + Math.random();
      this.particles.push({
        x,
        y,
        color: Math.random() > 0.5 ? color1 : color2,
        alpha: 0.9,
        size: type === "attack" ? 3 + Math.random() * 2 : 2 + Math.random() * 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (type === "attack" ? 1 : 0),
        life: type === "attack" ? 20 : 25,
        maxLife: type === "attack" ? 20 : 25,
      });
    }
  }

  private handleOrganismDeath(id: string) {
    const container = this.organisms.get(id);
    const orgData = this.organismData.get(id);

    if (container && orgData) {
      // Death particle burst
      const color = Phaser.Display.Color.HexStringToColor(orgData.color).color;
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        this.particles.push({
          x: container.x,
          y: container.y,
          color: i % 2 === 0 ? color : 0x808080,
          alpha: 0.8,
          size: 2 + Math.random() * 3,
          vx: Math.cos(angle) * (1 + Math.random() * 2),
          vy: Math.sin(angle) * (1 + Math.random() * 2),
          life: 30,
          maxLife: 30,
        });
      }

      // Fade out animation with spin
      this.tweens.add({
        targets: container,
        alpha: 0,
        scale: 0.3,
        rotation: container.rotation + Math.PI,
        duration: 600,
        ease: "Power2",
        onComplete: () => {
          container.destroy();
          this.organisms.delete(id);
          this.organismData.delete(id);
        },
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
      loop: true,
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

    // Update animation time
    this.animationTime += 0.05;

    // Just update movement and visuals, no game logic
    this.organismData.forEach((org, id) => {
      const container = this.organisms.get(id);
      if (!container) return;

      // Initialize runtime state if needed
      if (org.direction === undefined)
        org.direction = Math.random() * Math.PI * 2;
      if (org.animationPhase === undefined)
        org.animationPhase = Math.random() * Math.PI * 2;

      org.animationPhase += 0.08;

      if (org.type !== "plant" && org.locomotion !== "sessile") {
        // Gentle movement
        const movement = this.calculateEnhancedMovement(org);
        const locomotionMod = this.getLocomotionModifiers(org.locomotion);

        org.x += movement.x * locomotionMod.speedMult * 0.4; // Slower in aquarium mode
        org.y += movement.y * locomotionMod.speedMult * 0.4;
        org.y += (gravity - 1) * locomotionMod.gravityMult * 0.03;

        // Update direction
        if (Math.abs(movement.x) > 0.01 || Math.abs(movement.y) > 0.01) {
          const targetDir = Math.atan2(movement.y, movement.x);
          org.direction = Phaser.Math.Angle.RotateTo(
            org.direction,
            targetDir,
            0.05,
          );
        }

        // Locomotion-specific animations
        if (org.locomotion === "flying" || org.locomotion === "gliding") {
          org.y += Math.sin(this.animationTime * 2 + org.animationPhase) * 0.4;
        } else if (
          org.locomotion === "swimming" ||
          org.locomotion === "floating"
        ) {
          org.y += Math.sin(this.animationTime + org.animationPhase) * 0.25;
          org.x +=
            Math.sin(this.animationTime * 0.5 + org.animationPhase) * 0.15;
        }

        // Clamp to boundaries
        const padding = org.size / 2;
        org.x = Phaser.Math.Clamp(org.x, padding, width - padding);
        org.y = Phaser.Math.Clamp(org.y, padding, height - padding);

        // Smooth position update
        container.x = Phaser.Math.Linear(container.x, org.x, 0.08);
        container.y = Phaser.Math.Linear(container.y, org.y, 0.08);

        // Apply rotation
        if (org.type !== "decomposer" && org.type !== "microbe") {
          container.rotation = Phaser.Math.Linear(
            container.rotation,
            org.direction,
            0.05,
          );
        }

        // Idle animation
        const pulseScale = 1 + Math.sin(org.animationPhase) * 0.04;
        container.setScale(pulseScale);

        container.setDepth(100 + Math.floor(container.y));

        // Occasional particles in aquarium mode
        if (Math.random() < 0.1) {
          this.spawnLocomotionParticles(org);
        }
      } else {
        // Plants sway
        const sway =
          Math.sin(this.animationTime * 0.7 + org.animationPhase) * 0.04;
        container.rotation = sway;
        const pulseScale = 1 + Math.sin(org.animationPhase * 0.3) * 0.02;
        container.setScale(pulseScale);
      }
    });

    // Update particles
    this.updateParticles();
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
