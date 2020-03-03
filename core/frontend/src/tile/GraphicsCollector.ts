/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

import { Map4d } from "@bentley/geometry-core";
import { FrustumPlanes } from "@bentley/imodeljs-common";
import {
  TileDrawArgs,
  TileTreeReference,
} from "./internal";
import { SceneContext } from "../ViewContext";
import { RenderGraphic } from "../render/RenderGraphic";

/** @internal */
export interface GraphicsCollector {
  addGraphic(graphic: RenderGraphic): void;
}

/** @internal */
export class GraphicsCollectorDrawArgs extends TileDrawArgs {
  private _planes: FrustumPlanes;
  private _worldToViewMap: Map4d;
  private _collector: GraphicsCollector;

  private constructor(planes: FrustumPlanes, worldToViewMap: Map4d, collector: GraphicsCollector, args: TileDrawArgs) {
    super(args.context, args.location, args.tree, args.now, args.purgeOlderThan, args.graphics.viewFlagOverrides, args.clipVolume, args.parentsAndChildrenExclusive, args.graphics.symbologyOverrides);

    this._planes = planes;
    this._worldToViewMap = worldToViewMap;
    this._collector = collector;
  }

  public get frustumPlanes(): FrustumPlanes { return this._planes; }
  public get worldToViewMap(): Map4d { return this._worldToViewMap; }
  public drawGraphics(): void {
    if (!this.graphics.isEmpty)
      this._collector.addGraphic(this.context.createBranch(this.graphics, this.location));
  }

  public static create(context: SceneContext, collector: GraphicsCollector, ref: TileTreeReference, planes: FrustumPlanes, worldToViewMap: Map4d): TileDrawArgs | undefined {
    const args = ref.createDrawArgs(context);
    if (undefined === args)
      return undefined;

    return new GraphicsCollectorDrawArgs(planes, worldToViewMap, collector, args);
  }
}
