/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Effects
 */

import { Id64String } from "@bentley/bentleyjs-core";
import { Angle, Point3d, Range1d, Range3d, Transform, TransformProps, Vector3d } from "@bentley/geometry-core";
import { RenderTexture } from "@bentley/imodeljs-common";
import {
  BeButtonEvent, DecorateContext, EventHandled, GraphicType, HitDetail, imageElementFromUrl, IModelApp, IModelConnection, ParticleCollectionBuilder, ParticleProps, Tool,
} from "@bentley/imodeljs-frontend";

import { randomFloat, randomFloatInRange, randomIntegerInRange, randomPositionInRange } from "./Random";

class FireParticle implements ParticleProps {
  public readonly position: Point3d;
  public readonly velocity: Vector3d;
  public readonly size: number;
  public transparency = 127;

  public constructor(position: Point3d, velocity: Vector3d, size: number) {
    this.position = position;
    this.velocity = velocity;
    this.size = size;
  }

  public get x() { return this.position.x; }
  public get y() { return this.position.y; }
  public get z() { return this.position.z; }
}

class FireParticleEmitter {
  public horizontalRange = Range1d.createXX(-1, 1);
  public verticalRange = Range1d.createXX(-0.05, 0.05);
  public sizeRange = Range1d.createXX(0.1, 0.3);
  public speedRange = Range1d.createXX(0.01, 0.2);
  public phiRange = Range1d.createXX(Math.PI / 2 - 0.42, Math.PI / 2 + 0.42);

  public emit(): FireParticle {
    const size = randomFloatInRange(this.sizeRange);
    const speed = randomFloatInRange(this.speedRange);
    const x = randomFloatInRange(this.horizontalRange);
    const y = randomFloatInRange(this.horizontalRange);
    const z = randomFloatInRange(this.verticalRange);
    const phi = Angle.createRadians(randomFloatInRange(this.phiRange));
    const theta = Angle.createRadians(randomFloat(0, Math.PI * 2));

    const position = new Point3d(x, y, z);
    const velocity = Vector3d.createSpherical(speed, theta, phi);
    return new FireParticle(position, velocity, size);
  }
}

class FireParticleSystem {
  public emissionRate = 1600;
  public deathSpeed = 0.003 * 255;
  public triangularity = 0.00015;
  public readonly emitter = new FireParticleEmitter();
  private readonly _particles: FireParticle[] = [];
  private readonly _origin: Point3d;
  private readonly _texture: RenderTexture;
  private readonly _pickableId: Id64String;
  private _lastUpdateTime: number;
  private _dispose?: VoidFunction;

  public constructor(texture: RenderTexture, origin: Point3d, iModel: IModelConnection) {
    this._texture = texture;
    this._pickableId = iModel.transientIds.next;
    this._lastUpdateTime = Date.now();
    this._origin = origin;
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

  public decorate(context: DecorateContext): void {
    const viewport = context.viewport;
    if (!viewport.view.isSpatialView())
      return;

    this.updateParticles();
    const builder = ParticleCollectionBuilder.create({
      viewport,
      texture: this._texture,
      size: 1,
      origin: this._origin,
      pickableId: this._pickableId,
    });

    for (const particle of this._particles)
      builder.addParticle(particle);

    const graphic = builder.finish();
    if (graphic) {
      context.addDecoration(GraphicType.WorldDecoration, graphic);
      viewport.onRender.addOnce((vp) => vp.invalidateDecorations());
    }
  }

  public testDecorationHit(id: Id64String): boolean {
    return id === this._pickableId;
  }

  public async getDecorationToolTip(_hit: HitDetail): Promise<HTMLElement | string> {
    return "Fire Effect";
  }

  public async onDecorationButtonEvent(_hit: HitDetail, _ev: BeButtonEvent): Promise<EventHandled> {
    return EventHandled.Yes;
  }

  public static async addDecorator(iModel: IModelConnection): Promise<void> {
    const isOwned = true;
    const params = new RenderTexture.Params(undefined, undefined, isOwned);
    const image = await imageElementFromUrl("./sprites/particle_flame.png");
    const texture = await IModelApp.renderSystem.createTextureFromImage(image, true, undefined, params);
    if (texture)
      IModelApp.viewManager.addDecorator(new FireParticleSystem(texture, iModel.projectExtents.center, iModel));
  }

  private updateParticles(): void {
    const now = Date.now();
    const elapsedMillis = now - this._lastUpdateTime;
    const elapsedSeconds = Math.max(100, elapsedMillis) / 1000;
    this._lastUpdateTime = now;

    let numParticlesToBirth = elapsedSeconds * this.emissionRate;
    while (numParticlesToBirth-- > 0)
      this._particles.push(this.emitter.emit());

    let meanXY = 0;
    let meanZ = 0;
    let numParticles = this._particles.length;
    for (const particle of this._particles) {
      meanXY += particle.x / numParticles;
      meanXY += particle.y / numParticles;
      meanZ += particle.z / numParticles;
    }

    for (let i = 0; i < numParticles; i++) {
      const particle = this._particles[i];
      particle.position.addInPlace(particle.velocity);
      particle.transparency += this.deathSpeed + Math.abs(meanXY - Math.max(particle.x, particle.y)) * this.triangularity;

      if (particle.transparency > 255) { // || particle.z > 2) { // particle.z <= particle.size * 2) {
        this._particles[i] = this._particles[numParticles - 1];
        --i;
        --numParticles;
      }
    }

    this._particles.length = numParticles;
  }
}

export class FireEffect extends Tool {
  public static toolId = "FireEffect";

  public run(): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (vp)
      FireParticleSystem.addDecorator(vp.iModel);

    return true;
  }
}
