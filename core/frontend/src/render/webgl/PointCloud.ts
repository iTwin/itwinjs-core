/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */
import { Graphic } from "./Graphic";
import { PointCloudArgs } from "../primitives/PointCloudPrimitive";
import { IModelConnection } from "../../IModelConnection";
import { RenderCommands } from "./DrawCommand";

export class PointCloudGraphic extends Graphic {
  public readonly args: PointCloudArgs;
  public addCommands(_commands: RenderCommands): void {
  }
  public dispose(): void {
  }
  public static create(args: PointCloudArgs, iModel: IModelConnection) {
    return new PointCloudGraphic(args, iModel);
  }

  private constructor(args: PointCloudArgs, iModel: IModelConnection) {
    super(iModel);
    this.args = args;
  }
}
