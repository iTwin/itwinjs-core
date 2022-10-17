/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { Map4d } from "@itwin/core-geometry";
import { FrustumPlanes } from "@itwin/core-common";
import { TileDrawArgs } from "./internal";
import { RenderPlanarClassifier } from "../render/RenderPlanarClassifier";

/** @internal */
export class RealityTileDrawArgs extends TileDrawArgs {
  private readonly _worldToViewMap: Map4d;
  public override get worldToViewMap(): Map4d {
    return this._worldToViewMap;
  }
  public override get secondaryClassifiers() {
    return this._secondaryClassifiers;
  }

  public constructor(
    args: TileDrawArgs,
    worldToViewMap: Map4d,
    frustumPlanes: FrustumPlanes,
    public maxSelectionCount?: number,
    private _secondaryClassifiers?: Map<number, RenderPlanarClassifier>
  ) {
    super({ ...args, viewFlagOverrides: args.viewFlagOverrides, symbologyOverrides: args.symbologyOverrides, parentsAndChildrenExclusive: false });

    this._worldToViewMap = worldToViewMap;
    this._frustumPlanes = frustumPlanes;
  }
}
