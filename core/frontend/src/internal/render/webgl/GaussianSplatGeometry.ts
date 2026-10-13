/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Range3d } from "@itwin/core-geometry";
import { RenderMemory } from "../../../render/RenderMemory";
import { RenderGeometry } from "../RenderGeometry";
import { GaussianSplatData } from "../GaussianSplatData";
import { CachedGeometry } from "./CachedGeometry";
import { GaussianSplatAtlas, gaussianSplatRowBytes } from "./GaussianSplatAtlas";
import { Pass, RenderOrder } from "./RenderFlags";
import { TechniqueId } from "./TechniqueId";
import { Target } from "./Target";

let nextId = 0;

/** A tile's splats: the CPU copy that viewports sort, and its rows in the render system's atlas while a viewport displays it.
 * @internal
 */
export class GaussianSplatGeometry extends CachedGeometry implements RenderGeometry {
  public readonly renderGeometryType = "gaussian-splats";
  public readonly isInstanceable = false;
  public readonly id = ++nextId;
  public noDispose = false;
  /** The owning tile released this content. */
  private _contentReleased = false;
  /** The viewports that display or sort this content. */
  private readonly _retainers = new Set<object>();
  // Splat positions are not quantized; CachedGeometry requires these.
  public readonly qOrigin = new Float32Array(3);
  public readonly qScale = new Float32Array(3);

  /** @param _atlas Where its rows are uploaded while viewports retain it. */
  public constructor(public readonly splats: GaussianSplatData, private readonly _atlas?: GaussianSplatAtlas) {
    super();
    this._range = Range3d.createXYZXYZ(...splats.bounds);
  }

  public get isDisposed(): boolean { return this._contentReleased && !this._retainers.size; }

  /** The owning tile released this content; viewports that still display or sort it keep it alive. */
  public get isContentReleased(): boolean { return this._contentReleased; }

  /** Bytes of the CPU copy. */
  public get cpuBytes(): number { return this.splats.data.byteLength + this.splats.sh.byteLength; }

  /** Keep completed display data alive while its owning tile is replaced or evicted. */
  public retain(user: object): void { this._retainers.add(user); }

  /** Stop keeping this content alive for `user`. Once no viewport retains it, its atlas rows are freed. */
  public release(user: object): void {
    this._retainers.delete(user);
    if (!this._retainers.size)
      this._atlas?.remove(this);
  }

  public get techniqueId(): TechniqueId { return TechniqueId.Invalid; }
  public get renderOrder(): RenderOrder { return RenderOrder.UnlitSurface; }
  public override get hasFeatures(): boolean { return true; }
  public override get usesQuantizedPositions(): boolean { return false; }
  protected _wantWoWReversal(): boolean { return false; }
  public getPass(target: Target): Pass { return target.is2d || this.isDisposed ? "none" : "gaussian-splats"; }
  public draw(): void { /* The dedicated compositor pass draws a viewport-wide sorted instance list. */ }

  public [Symbol.dispose](): void {
    if (!this.noDispose)
      this._contentReleased = true;
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    // The tile's content is its CPU copy, kept for sorting, and the atlas rows it occupies while displayed. The rows are counted
    // whether or not it is displayed, since the tile cache measures a tile once, when it loads.
    stats.addGaussianSplats(this.cpuBytes);
    stats.addTexture(gaussianSplatRowBytes(this.splats));
  }
}
