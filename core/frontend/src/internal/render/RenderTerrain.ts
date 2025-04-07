/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Range2d, Transform, Vector2d } from "@itwin/core-geometry";
import { RenderMemory } from "../../render/RenderMemory.js";
import { RenderTexture } from "@itwin/core-common";

export abstract class RenderTerrainGeometry implements Disposable, RenderMemory.Consumer {
  public abstract [Symbol.dispose](): void;
  public abstract get transform(): Transform | undefined;
  public abstract collectStatistics(stats: RenderMemory.Statistics): void;
}

export class TerrainTexture {
  public constructor(
    public readonly texture: RenderTexture,
    public featureId: number,
    public readonly scale: Vector2d,
    public readonly translate: Vector2d,
    public readonly targetRectangle: Range2d,
    public readonly layerIndex: number,
    public transparency: number,
    public readonly clipRectangle?: Range2d,
  ) { }

  public cloneWithClip(clipRectangle: Range2d) {
    return new TerrainTexture(this.texture, this.featureId, this.scale, this.translate, this.targetRectangle, this.layerIndex, this.transparency, clipRectangle);
  }
}

