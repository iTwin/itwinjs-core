/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Effects
 */

import { dispose } from "@bentley/bentleyjs-core";
import { Point2d, Range1d, Range2d, Vector2d } from "@bentley/geometry-core";
import { ColorDef, GraphicParams, ImageBuffer, ImageBufferFormat, RenderTexture } from "@bentley/imodeljs-common";
import {
  DecorateContext, Decorator, GraphicType, ParticleCollectionBuilder, ParticleProps, IModelApp, Tool, Viewport,
} from "@bentley/imodeljs-frontend";
import { parseToggle } from "../tools/parseToggle";

/** Generate integer in [min, max]. */
function randomInteger(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Generate floating-point number in [min, max). */
function randomNumber(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/** If the input value exceeds one of the bounds, wrap it around to the opposite bound. */
function wrapAround(value: number, min: number, max: number): number {
  if (value < min)
    return max;

  return value > max ? min : value;
}

/** Represents one particle displayed by SnowDecorator. */
interface SnowParticle extends ParticleProps {
  /** Make x, y, and z from ParticleProps writable. */
  x: number;
  y: number;
  z: number;

  /** Current velocity, in pixels per second. */
  velocity: Vector2d;
}

/** Simulates snowfall in a Viewport. */
class SnowDecorator implements Decorator {
  /** The viewport being decorated. */
  public readonly viewport: Viewport;
  /** Invoked when this decorator is to be destroyed. */
  public readonly dispose: VoidFunction;
  /** The number of snow particles to produce. This could alternatively be expressed as a density so that small viewports would not be more crowded than larger ones. */
  public numParticles = 1200;
  /** Range from which to randomly select each particle's size, in pixels. */
  public readonly sizeRange = Range1d.createXX(1, 15);
  /** Range from which to randomly select each particle's transparency. */
  public readonly transparencyRange = Range1d.createXX(0, 200);
  /** Range from which to randomly select each particle's initial velocity, in pixels per second. */
  public readonly velocityRange = new Range2d(-25, 30, 25, 90);
  /** Range from which to randomly select an acceleration to apply to each particle's velocity each frame, in pixels per second squared, to simulate wind. */
  public readonly accelerationRange = new Range2d(-1, -0.25, 1, 0.25);
  /** The initial width and height of the viewport, from which we randomly select each particle's initial position. */
  private readonly _dimensions: Point2d;
  /** The list of particles being drawn. */
  private readonly _particles: SnowParticle[] = [];
  /** The image to display for each particle. */
  private _texture?: RenderTexture;
  /** The last time `updateParticles()` was invoked, in milliseconds. */
  private _lastUpdateTime: number;

  private constructor(viewport: Viewport) {
    this.viewport = viewport;
    this._dimensions = new Point2d(viewport.viewRect.width, viewport.viewRect.height);
    this._lastUpdateTime = Date.now();

    // ###TODO: createTextureFromImageBuffer should permit undefined for iModel.
    const image = ImageBuffer.create(new Uint8Array([255, 255, 0, 255]), ImageBufferFormat.Rgba, 1);
    this._texture = IModelApp.renderSystem.createTextureFromImageBuffer(image, viewport.iModel, new RenderTexture.Params(undefined, RenderTexture.Type.Normal, true));

    // Tell the viewport to re-render the decorations every frame so that the snow particles animate smoothly.
    const removeOnRender = viewport.onRender.addListener(() => viewport.invalidateDecorations());

    // When the viewport is resized, replace this decorator with a new one to match the new dimensions.
    const removeOnResized = viewport.onResized.addListener(() => {
      this.dispose();
      new SnowDecorator(viewport);
    });

    // When the viewport is destroyed, dispose of this decorator too.
    const removeOnDispose = viewport.onDisposed.addListener(() => this.dispose());
    const removeDecorator = IModelApp.viewManager.addDecorator(this);

    this.dispose = () => {
      removeDecorator();
      removeOnRender();
      removeOnDispose();
      removeOnResized();
      this._texture = dispose(this._texture);
      SnowDecorator._decorators.delete(viewport);
    };

    SnowDecorator._decorators.set(viewport, this);

    // Initialize the particles.
    for (let i = 0; i < this.numParticles; i++) {
      this._particles.push({
        x: randomInteger(0, this._dimensions.x),
        y: randomInteger(0, this._dimensions.y),
        z: 0,
        velocity: new Vector2d(randomNumber(this.velocityRange.low.x, this.velocityRange.high.x), randomNumber(this.velocityRange.low.y, this.velocityRange.high.y)),
        size: randomInteger(this.sizeRange.low, this.sizeRange.high),
        transparency: randomInteger(this.transparencyRange.low, this.transparencyRange.high),
      });
    }
  }

  public decorate(context: DecorateContext): void {
    if (context.viewport !== this.viewport || !this._texture)
      return;

    // Update the particles.
    const now = Date.now();
    const deltaMillis = now - this._lastUpdateTime;
    this._lastUpdateTime = now;
    this.updateParticles(deltaMillis / 1000);

    // Create particle graphics.
    const builder = ParticleCollectionBuilder.create({
      texture: this._texture,
      size: (this.sizeRange.high - this.sizeRange.low) / 2,
    });

    for (const particle of this._particles)
      builder.addParticle(particle);

    const graphic = builder.finish();
    if (graphic)
      context.addDecoration(GraphicType.ViewOverlay, graphic);
  }

  // Update the positions and velocities of all the particles based on the amount of time that has passed since the last update.
  private updateParticles(elapsedSeconds: number): void {
    const acceleration = new Vector2d();
    const velocity = new Vector2d();
    for (const particle of this._particles) {
      // Apply some acceleration to produce random drift.
      acceleration.set(randomNumber(this.accelerationRange.low.x, this.accelerationRange.high.x), randomNumber(this.accelerationRange.low.y, this.accelerationRange.high.y));
      acceleration.scale(elapsedSeconds, acceleration);
      particle.velocity.plus(acceleration, particle.velocity);

      // Apply velocity.
      particle.velocity.clone(velocity);
      velocity.scale(elapsedSeconds, velocity);
      particle.x += velocity.x;
      particle.y += velocity.y;

      // Particles that travel beyond the viewport's borders wrap around to the other side.
      particle.x = wrapAround(particle.x, 0, this._dimensions.x);
      particle.y = wrapAround(particle.y, 0, this._dimensions.y);
    }
  }

  private static readonly _decorators = new Map<Viewport, SnowDecorator>();

  public static getOrCreate(viewport: Viewport): SnowDecorator {
    return this._decorators.get(viewport) ?? new SnowDecorator(viewport);
  }

  public static toggle(viewport: Viewport, enable?: boolean): void {
    const decorator = this._decorators.get(viewport);
    if (undefined === enable)
      enable = undefined === decorator;

    if (undefined !== decorator && !enable)
      decorator.dispose();
    else if (undefined === decorator && enable)
      new SnowDecorator(viewport);
  }
}

/** Toggles a decorator that simulates snow using particle effects.
 * @beta
 */
export class SnowEffect extends Tool {
  public static toolId = "SnowEffect";

  public run(enable?: boolean): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (vp)
      SnowDecorator.toggle(vp, enable);

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    const enable = parseToggle(args[0]);
    if (typeof enable !== "string")
      this.run(enable);

    return true;
  }
}
