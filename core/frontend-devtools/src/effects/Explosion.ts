/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Effects
 */

import { Id64String } from "@bentley/bentleyjs-core";
import { Point3d, Range1d, Range3d, Transform, TransformProps, Vector3d } from "@bentley/geometry-core";
import { RenderTexture } from "@bentley/imodeljs-common";
import {
  BeButtonEvent, DecorateContext, EventHandled, GraphicType, HitDetail, imageElementFromUrl, IModelApp, IModelConnection, ParticleCollectionBuilder, ParticleProps, Tool,
} from "@bentley/imodeljs-frontend";

/** Generate random integer in [range.low, range.high]. */
function randomIntegerInRange(range: Range1d): number {
  return Math.floor(Math.random() * (range.high - range.low + 1)) + range.low;
}

/** Generate random floating-point number in [range.low, range.high). */
function randomNumberInRange(range: Range1d): number {
  return randomNumber(range.low, range.high);
}

/** Generate random floating-point number in [min, max). */
function randomNumber(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/** Generate a random position in the specified range. */
function randomPositionInRange(range: Range3d): Point3d {
  const x = randomNumber(range.low.x, range.high.x);
  const y = randomNumber(range.low.y, range.high.y);
  const z = randomNumber(range.low.z, range.high.z);
  return new Point3d(x, y, z);
}

/** Represents one particle in the system. */
class Particle implements ParticleProps {
  /** Current position in the particle system's local coordinate space. */
  public readonly position: Point3d;
  /** Current velocity in meters per second. */
  public readonly velocity: Vector3d;
  /** Current age in seconds, incremented each frame. */
  public age = 0;
  /** Maximum age in seconds. When `this.age` exceeds `this.lifetime`, the particle expires. */
  public readonly lifetime: number;
  /** Particle size in meters. */
  public size: number;

  public get x() { return this.position.x; }
  public get y() { return this.position.y; }
  public get z() { return this.position.z; }

  public constructor(position: Point3d, velocity: Vector3d, lifetime: number, size: number) {
    this.position = position;
    this.velocity = velocity;
    this.lifetime = lifetime;
    this.size = size;
  }

  public get isExpired() { return this.age >= this.lifetime; }
}

/** Emits particles in a sphere with its center at the origin.
 * Each particle is emitted from the center of the sphere with random velocity toward the surface of the sphere.
 */
class ParticleEmitter {
  /** Range from which each particle's initial speed in meters per second will be selected. */
  public readonly speedRange = Range1d.createXX(3, 6);
  /** Range from which each particle's lifetime in seconds will be selected. */
  public readonly lifetimeRange = Range1d.createXX(5, 10);
  /** Range from which each particle's size in meters will be selected. */
  public readonly sizeRange = Range1d.createXX(0.2, 1.0);
  /** Range from which the number of particles emitted will be selected. */
  public numParticlesRange = Range1d.createXX(1600, 2200);

  /** Emit an explosion of particles from the center of the sphere. */
  public emit(): Particle[] {
    const particles = [];
    const numParticles = randomIntegerInRange(this.numParticlesRange);
    for (let i = 0; i < numParticles; i++) {
      const velocity = new Vector3d(randomNumber(-1.0, 1.0), randomNumber(-1.0, 1.0), randomNumber(-1.0, 1.0));
      velocity.normalizeInPlace();
      velocity.scaleInPlace(randomNumberInRange(this.speedRange));

      const lifetime = randomNumberInRange(this.lifetimeRange);
      const size = randomNumberInRange(this.sizeRange);
      particles.push(new Particle(new Point3d(0, 0, 0), velocity, lifetime, size));
    }

    return particles;
  }
}

class ParticleSystem {
  private readonly _origin: Point3d;
  private readonly _pickableId: Id64String;
  private readonly _emitter = new ParticleEmitter();
  private _numEmissions: number;
  private readonly _texture: RenderTexture;
  private _lastUpdateTime: number;
  private _particles: Particle[] = [];
  private readonly _scratchVector3d = new Vector3d();
  private _dispose?: VoidFunction;
  /** Acceleration in Z applied to particles, in meters per second squared. */
  public gravity = -3;

  public static numEmissionsRange = Range1d.createXX(1, 5);

  public constructor(texture: RenderTexture, iModel: IModelConnection, numEmissions: number) {
    this._texture = texture;
    this._pickableId = iModel.transientIds.next;
    this._numEmissions = numEmissions;
    this._lastUpdateTime = Date.now();

    this._origin = randomPositionInRange(iModel.projectExtents);

    this._dispose = iModel.onClose.addListener(() => this.dispose());
  }

  public dispose(): void {
    if (this._dispose) {
      this._dispose();
      this._dispose = undefined;
    }

    IModelApp.viewManager.dropDecorator(this);
    this._texture.dispose();
  }

  public update(): void {
    const now = Date.now();
    let deltaMillis = now - this._lastUpdateTime;
    deltaMillis = Math.min(100, deltaMillis);
    this._lastUpdateTime = now;

    let numParticles = this._particles.length;
    if (numParticles === 0) {
      this._numEmissions--;
      if (this._numEmissions < 0)
        this.dispose();
      else
        this._particles = this._emitter.emit();

      return;
    }

    const elapsedSeconds = deltaMillis / 1000;
    for (let i = 0; i < numParticles; i++) {
      const particle = this._particles[i];
      this.updateParticle(particle, elapsedSeconds);
      if (particle.isExpired) {
        this._particles[i] = this._particles[numParticles - 1];
        --i;
        --numParticles;
      }
    }

    this._particles.length = numParticles;
  }

  private updateParticle(particle: Particle, elapsedSeconds: number): void {
    const velocity = particle.velocity.clone(this._scratchVector3d);
    velocity.scale(elapsedSeconds, velocity);
    velocity.z += elapsedSeconds * this.gravity;
    particle.position.addInPlace(velocity);

    particle.age += elapsedSeconds;
  }

  public decorate(context: DecorateContext): void {
    if (!context.viewport.view.isSpatialView())
      return;

    this.update();

    const builder = ParticleCollectionBuilder.create({
      viewport: context.viewport,
      texture: this._texture,
      size: (this._emitter.sizeRange.high - this._emitter.sizeRange.low) / 2,
      transparency: 0,
      origin: this._origin,
      pickableId: this._pickableId,
    });

    for (const particle of this._particles)
      builder.addParticle(particle);

    const graphic = builder.finish();
    if (graphic) {
      context.addDecoration(GraphicType.WorldDecoration, graphic);
      context.viewport.onRender.addOnce((vp) => vp.invalidateDecorations());
    }
  }

  public testDecorationHit(id: Id64String): boolean {
    return id === this._pickableId;
  }

  public async getDecorationToolTip(_hit: HitDetail): Promise<HTMLElement | string> {
    return "Explosion effect";
  }

  public async onDecorationButtonEvent(_hit: HitDetail, _ev: BeButtonEvent): Promise<EventHandled> {
    return EventHandled.Yes;
  }

  public static async addDecorator(iModel: IModelConnection): Promise<void> {
    const isOwned = true;
    const params = new RenderTexture.Params(undefined, undefined, isOwned);
    const image = await imageElementFromUrl("./sprites/particle_explosion.png");
    const texture = await IModelApp.renderSystem.createTextureFromImage(image, true, undefined, params);
    if (texture)
      IModelApp.viewManager.addDecorator(new ParticleSystem(texture, iModel, randomNumberInRange(this.numEmissionsRange)));
  }
}

export class ExplosionEffect extends Tool {
  public static toolId = "ExplosionEffect";

  public run(): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (vp)
      ParticleSystem.addDecorator(vp.iModel);

    return true;
  }
}
