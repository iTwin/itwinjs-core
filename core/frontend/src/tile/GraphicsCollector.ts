/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { Map4d } from "@bentley/geometry-core";
import { FrustumPlanes } from "@bentley/imodeljs-common";
import { GraphicBranch } from "../render/GraphicBranch";
import { RenderGraphic } from "../render/RenderGraphic";
import { SceneContext } from "../ViewContext";
import { TileDrawArgs, TileGraphicType, TileTreeReference } from "./internal";

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
    super(args);

    this._planes = planes;
    this._worldToViewMap = worldToViewMap;
    this._collector = collector;
  }

  public get frustumPlanes(): FrustumPlanes { return this._planes; }
  public get worldToViewMap(): Map4d { return this._worldToViewMap; }
  public drawGraphicsWithType(_graphicType: TileGraphicType, graphics: GraphicBranch) {
    this._collector.addGraphic(this.context.createBranch(graphics, this.location));
  }

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
