import Phaser from 'phaser';
import { MainScene, TextureConfig, FallbackTextureConfig, ImageTextureConfig, SimulationCallbacks } from './MainScene';
import { Organism, WorldConfig } from '@/types';

export type { TextureConfig, FallbackTextureConfig, ImageTextureConfig };

export interface GameConfig {
  parent: string | HTMLElement;
  width: number;
  height: number;
}

export class PetridiseGame {
  private game: Phaser.Game | null = null;
  private scene: MainScene | null = null;

  constructor(config: GameConfig) {
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: config.parent,
      width: config.width,
      height: config.height,
      backgroundColor: '#0a0a0f',
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false
        }
      },
      scene: [], // Don't auto-start any scene
      scale: {
        mode: Phaser.Scale.NONE, // Don't auto-scale, we handle it
        autoCenter: Phaser.Scale.CENTER_BOTH
      },
      render: {
        pixelArt: false,
        antialias: true,
        transparent: false
      }
    });

    // Add scene but don't start it
    this.game.scene.add('MainScene', MainScene, false);
  }

  startSimulation(
    world: WorldConfig,
    organisms: Organism[],
    texture: TextureConfig,
    maxTicks: number,
    callbacks: SimulationCallbacks
  ) {
    const sceneData = {
      world,
      organisms,
      texture,
      maxTicks,
      callbacks
    };

    // Stop current scene if running
    if (this.game?.scene.isActive('MainScene')) {
      this.game.scene.stop('MainScene');
    }

    // Start scene with data
    this.game?.scene.start('MainScene', sceneData);
    this.scene = this.game?.scene.getScene('MainScene') as MainScene;
  }

  pause() {
    this.scene?.pauseSimulation();
  }

  resume() {
    this.scene?.resumeSimulation();
  }

  stop() {
    this.scene?.stopSimulation();
  }

  getOrganisms(): Organism[] {
    return this.scene?.getOrganisms() || [];
  }

  getCurrentTick(): number {
    return this.scene?.getCurrentTick() || 0;
  }

  destroy() {
    this.game?.destroy(true);
    this.game = null;
    this.scene = null;
  }

  resize(width: number, height: number) {
    this.game?.scale.resize(width, height);
  }
}

export { MainScene };
export type { SimulationCallbacks };
