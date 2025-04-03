/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */
import { dispose } from "@itwin/core-bentley";
import { Matrix4d } from "@itwin/core-geometry";
import { SceneContext } from "../../../ViewContext.js";
import { RenderMemory } from "../../../render/RenderMemory.js";
import { RenderTextureDrape } from "../RenderTextureDrape.js";
import { WebGLDisposable } from "./Disposable.js";
import { Target } from "./Target.js";
import { Texture } from "./Texture.js";

export abstract class TextureDrape implements RenderTextureDrape, RenderMemory.Consumer, WebGLDisposable {
  protected _texture?: Texture;
  protected _projectionMatrix = Matrix4d.createIdentity();
  public get texture(): Texture | undefined { return this._texture; }
  public get projectionMatrix(): Matrix4d { return this._projectionMatrix; }
  public abstract collectGraphics(context: SceneContext): void;
  public abstract draw(target: Target): void;
  public get isReady(): boolean { return this._texture !== undefined; }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    if (undefined !== this._texture)
      stats.addPlanarClassifier(this._texture.bytesUsed);
  }

  public get isDisposed(): boolean { return undefined === this.texture; }

  public [Symbol.dispose]() {
    this._texture = dispose(this._texture);
  }

  public getParams(params: Float32Array): void {
    params[0] = 5.0; // Inside, pure texture.
    params[1] = 0.0; // Outside, off.
  }
}
