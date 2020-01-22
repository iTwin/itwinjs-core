/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

import {
  BeTimePoint,
} from "@bentley/bentleyjs-core";
import {
  Map4d,
  Transform,
} from "@bentley/geometry-core";
import {
  FrustumPlanes,
} from "@bentley/imodeljs-common";
import {
  TileTree,
  TileDrawArgs,
} from "./internal";
import { SceneContext } from "../ViewContext";
import {
  RenderClipVolume,
  RenderGraphic,
} from "../render/System";

/** @internal */
export interface GraphicsCollector {
  addGraphic(graphic: RenderGraphic): void;
}

/** @internal */
export class GraphicsCollectorDrawArgs extends TileDrawArgs {
  constructor(private _planes: FrustumPlanes, private _worldToViewMap: Map4d, private _collector: GraphicsCollector, context: SceneContext, location: Transform, root: TileTree, now: BeTimePoint, purgeOlderThan: BeTimePoint, clip?: RenderClipVolume) {
    super(context, location, root, now, purgeOlderThan, clip);
  }
  public get frustumPlanes(): FrustumPlanes { return this._planes; }
  protected get worldToViewMap(): Map4d { return this._worldToViewMap; }
  public drawGraphics(): void {
    if (!this.graphics.isEmpty)
      this._collector.addGraphic(this.context.createBranch(this.graphics, this.location));
  }

  public static create(context: SceneContext, collector: GraphicsCollector, tileTree: TileTree, planes: FrustumPlanes, worldToViewMap: Map4d) {
    const now = BeTimePoint.now();
    const purgeOlderThan = now.minus(tileTree.expirationTime);
    return new GraphicsCollectorDrawArgs(planes, worldToViewMap, collector, context, tileTree.location.clone(), tileTree, now, purgeOlderThan, tileTree.clipVolume);
  }
}
