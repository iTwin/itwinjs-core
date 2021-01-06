/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Effects
 */

import { Point2d, Range1d, Range2d, Vector2d } from "@bentley/geometry-core";
import { ColorDef, GraphicParams } from "@bentley/imodeljs-common";
import { DecorateContext,GraphicType, IModelApp, Tool, Viewport } from "@bentley/imodeljs-frontend";
import { parseToggle } from "../tools/parseToggle";

// Generate integer in [min, max], inclusive.
function randomInteger(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomNumber(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

interface SnowParticle {
  position: Point2d;
  velocity: Vector2d;
  size: number;
  transparency: number;
}

class SnowDecorator {
  public readonly viewport: Viewport;
  public readonly dispose: VoidFunction;
  public numParticles = 1200;
  public readonly sizeRange = Range1d.createXX(1, 15);
  public readonly transparencyRange = Range1d.createXX(0, 200);
  public readonly velocityRange = new Range2d(-20, 20, 20, 70);
  private readonly _dimensions: Point2d;
  private readonly _particles: SnowParticle[] = [];
  private _lastUpdateTime: number;

  private constructor(viewport: Viewport) {
    this.viewport = viewport;
    this._dimensions = new Point2d(viewport.viewRect.width, viewport.viewRect.height);
    this._lastUpdateTime = Date.now();

    const removeDecorator = IModelApp.viewManager.addDecorator(this);
    const removeOnRender = viewport.onRender.addListener(() => viewport.invalidateDecorations());
    const removeOnDispose = viewport.onDisposed.addListener(() => this.dispose());

    this.dispose = () => {
      removeDecorator();
      removeOnRender();
      removeOnDispose();
      SnowDecorator._decorators.delete(viewport);
    };

    SnowDecorator._decorators.set(viewport, this);

    for (let i = 0; i < this.numParticles; i++) {
      this._particles.push({
        position: new Point2d(randomInteger(0, this._dimensions.x), randomInteger(0, this._dimensions.y)),
        velocity: new Vector2d(randomNumber(this.velocityRange.low.x, this.velocityRange.high.x), randomNumber(this.velocityRange.low.y, this.velocityRange.high.y)),
        size: randomInteger(this.sizeRange.low, this.sizeRange.high),
        transparency: randomInteger(this.transparencyRange.low, this.transparencyRange.high),
      });
    }
  }

  public decorate(context: DecorateContext): void {
    if (context.viewport !== this.viewport)
      return;

    const now = Date.now();
    const deltaMillis = now - this._lastUpdateTime;
    this._lastUpdateTime = now;
    this.updateParticles(deltaMillis / 1000);

    const params = new GraphicParams();
    params.lineColor = ColorDef.white;

    const builder = context.createGraphicBuilder(GraphicType.ViewOverlay);
    builder.preserveOrder = false;

    for (const particle of this._particles) {
      params.setLineTransparency(particle.transparency);
      params.rasterWidth = particle.size;
      builder.activateGraphicParams(params);
      builder.addPointString2d([particle.position], 0);
    }

    context.addDecorationFromBuilder(builder);
  }

  private updateParticles(timeDelta: number): void {
    for (const particle of this._particles) {
      particle.position.y += particle.velocity.y * timeDelta;
      if (particle.position.y > this._dimensions.y)
        particle.position.y = 0;

      particle.position.x += particle.velocity.x * timeDelta;
      if (particle.position.x > this._dimensions.x)
        particle.position.x = 0;
      else if (particle.position.x < 0)
        particle.position.x = this._dimensions.x;
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
