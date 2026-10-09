/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Range3d } from "@itwin/core-geometry";
import { RenderMemory } from "../../../render/RenderMemory";
import { RenderGeometry } from "../RenderGeometry";
import { gaussianSplatAuxiliaryStride } from "./GaussianSplatAtlas";
import { GaussianSplatData } from "../GaussianSplatData";
import { CachedGeometry } from "./CachedGeometry";
import { Pass, RenderOrder } from "./RenderFlags";
import { TechniqueId } from "./TechniqueId";
import { Target } from "./Target";

let nextId = 0;

/** CPU data shared by graphics and viewports. GPU pages are managed by the system's splat atlas.
 * @internal
 */
export class GaussianSplatGeometry extends CachedGeometry implements RenderGeometry {
  public readonly renderGeometryType = "gaussian-splats";
  public readonly isInstanceable = false;
  public readonly id = ++nextId;
  public noDispose = false;
  private _disposed = false;
  private readonly _retained = new Set<object>();
  public readonly qOrigin = new Float32Array(3);
  public readonly qScale = new Float32Array(3);

  public constructor(public readonly splats: GaussianSplatData) {
    super();
    this._range = Range3d.createXYZXYZ(...splats.bounds);
  }

  public get isDisposed(): boolean { return this._disposed && !this._retained.size; }
  /** Keep completed display data alive while its owning tile is replaced or evicted. */
  public retain(user: object): void { this._retained.add(user); }
  public release(user: object): void { this._retained.delete(user); }
  public get techniqueId(): TechniqueId { return TechniqueId.Invalid; }
  public get renderOrder(): RenderOrder { return RenderOrder.UnlitSurface; }
  public override get hasFeatures(): boolean { return true; }
  public override get usesQuantizedPositions(): boolean { return false; }
  protected _wantWoWReversal(): boolean { return false; }
  public getPass(target: Target): Pass { return target.is2d || this.isDisposed ? "none" : "gaussian-splats"; }
  public draw(): void { /* The dedicated compositor pass draws a viewport-wide sorted instance list. */ }
  public [Symbol.dispose](): void {
    if (!this.noDispose)
      this._disposed = true;
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    // Account for resident CPU data and its worst-case GPU page allocation in tile-cache budgeting.
    stats.addPointCloud(this.splats.data.byteLength + this.splats.sh.byteLength + (this.splats.covariance?.byteLength ?? 0) + (this.splats.appearance?.byteLength ?? 0));
    stats.addTexture(Math.ceil(this.splats.count / 16384) * 16384 * 32 + this.splats.count * gaussianSplatAuxiliaryStride(this.splats) * 4);
  }
}
